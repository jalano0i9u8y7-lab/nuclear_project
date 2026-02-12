"""
M56: Safe Auto-Rollback on Skill Regression.
Non-blocking rollback recommendation system.
"""
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import json
import structlog

log = structlog.get_logger()

class RollbackCandidate(BaseModel):
    skill_id: str
    from_version: str
    to_version: str
    reason: str

class RollbackPlan(BaseModel):
    phase: str
    candidates: List[RollbackCandidate]
    confidence: str  # "high", "medium", "low", "insufficient_history"
    notes: List[str]
    last_ok_run_id: Optional[str]
    last_ok_skills_hash: Optional[str]

def generate_rollback_plan(phase: str) -> RollbackPlan:
    """
    Generate rollback plan based on validation failures and drift.
    Non-blocking: always returns a plan, never raises.
    """
    from nuclear.db.sqlite import SQLiteEngine
    
    notes = []
    candidates = []
    confidence = "insufficient_history"
    last_ok_run_id = None
    last_ok_skills_hash = None
    
    try:
        # Find last run with validator ok=true
        with SQLiteEngine.transaction() as conn:
            # Query snapshots_index for last successful run
            # We need to check snapshot payload for _validation.ok
            # This is expensive, so we'll use skills_runs table instead
            # and assume correlation with validation
            
            # Get last 10 skills_runs for this phase
            rows = conn.execute(
                """SELECT run_id, skills_hash, skills_json 
                   FROM skills_runs 
                   WHERE phase = ? 
                   ORDER BY ts DESC 
                   LIMIT 10""",
                (phase,)
            ).fetchall()
            
            if len(rows) < 2:
                notes.append("Insufficient history: need at least 2 runs")
                return RollbackPlan(
                    phase=phase,
                    candidates=[],
                    confidence="insufficient_history",
                    notes=notes,
                    last_ok_run_id=None,
                    last_ok_skills_hash=None
                )
            
            # Assume first row is current (failed), second is last ok
            # In real implementation, we'd check _validation.ok from snapshot
            current_run_id = rows[0][0]
            current_hash = rows[0][1]
            current_skills = json.loads(rows[0][2])
            
            # Find last different hash (assume it was ok)
            last_ok_skills = None
            for row in rows[1:]:
                if row[1] != current_hash:
                    last_ok_run_id = row[0]
                    last_ok_skills_hash = row[1]
                    last_ok_skills = json.loads(row[2])
                    break
            
            if not last_ok_skills:
                notes.append("No different skills version found in history")
                return RollbackPlan(
                    phase=phase,
                    candidates=[],
                    confidence="insufficient_history",
                    notes=notes,
                    last_ok_run_id=None,
                    last_ok_skills_hash=None
                )
            
            # Compute diff
            current_ids = set(current_skills.keys())
            last_ok_ids = set(last_ok_skills.keys())
            
            # Changed versions
            for skill_id in current_ids & last_ok_ids:
                if current_skills[skill_id] != last_ok_skills[skill_id]:
                    candidates.append(RollbackCandidate(
                        skill_id=skill_id,
                        from_version=current_skills[skill_id],
                        to_version=last_ok_skills[skill_id],
                        reason="Version changed since last known good run"
                    ))
            
            # Added skills (rollback = remove)
            for skill_id in current_ids - last_ok_ids:
                candidates.append(RollbackCandidate(
                    skill_id=skill_id,
                    from_version=current_skills[skill_id],
                    to_version="<remove>",
                    reason="Skill added since last known good run"
                ))
            
            # Removed skills (rollback = add back)
            for skill_id in last_ok_ids - current_ids:
                candidates.append(RollbackCandidate(
                    skill_id=skill_id,
                    from_version="<missing>",
                    to_version=last_ok_skills[skill_id],
                    reason="Skill removed since last known good run"
                ))
            
            if candidates:
                confidence = "medium"
                notes.append(f"Found {len(candidates)} rollback candidates")
            else:
                confidence = "low"
                notes.append("No skill changes detected")
            
            return RollbackPlan(
                phase=phase,
                candidates=candidates,
                confidence=confidence,
                notes=notes,
                last_ok_run_id=last_ok_run_id,
                last_ok_skills_hash=last_ok_skills_hash
            )
    except Exception as e:
        log.error("generate_rollback_plan_failed", phase=phase, error=str(e))
        notes.append(f"Plan generation failed: {str(e)}")
        return RollbackPlan(
            phase=phase,
            candidates=[],
            confidence="insufficient_history",
            notes=notes,
            last_ok_run_id=None,
            last_ok_skills_hash=None
        )

def apply_rollback_plan(plan: RollbackPlan) -> Dict[str, Any]:
    """
    Apply rollback plan by updating manifest.
    Returns audit record.
    """
    from nuclear.skills.manifest import load_manifest, save_manifest
    from datetime import datetime, timezone
    
    if not plan.candidates:
        return {
            "status": "no_changes",
            "message": "No rollback candidates to apply"
        }
    
    try:
        manifest_before = load_manifest()
        manifest_after = manifest_before.copy()
        
        for candidate in plan.candidates:
            if candidate.to_version == "<remove>":
                # Remove from manifest
                if candidate.skill_id in manifest_after:
                    del manifest_after[candidate.skill_id]
            elif candidate.from_version == "<missing>":
                # Add to manifest
                manifest_after[candidate.skill_id] = candidate.to_version
            else:
                # Update version
                manifest_after[candidate.skill_id] = candidate.to_version
        
        # Save manifest
        save_manifest(manifest_after)
        
        # Create audit record
        audit = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "phase": plan.phase,
            "manifest_before": manifest_before,
            "manifest_after": manifest_after,
            "candidates_applied": [c.model_dump() for c in plan.candidates],
            "operator": "cli",
            "status": "applied"
        }
        
        # Save audit snapshot
        try:
            from nuclear.storage.snapshot import SnapshotWriter
            SnapshotWriter().save(
                phase="skills_manifest_change",
                payload=audit,
                run_id=f"rollback_{plan.phase}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
            )
        except Exception as e:
            log.warning("audit_snapshot_failed", error=str(e))
        
        return audit
    except Exception as e:
        log.error("apply_rollback_failed", error=str(e))
        return {
            "status": "failed",
            "message": str(e)
        }
