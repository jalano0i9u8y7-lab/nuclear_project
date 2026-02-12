"""
M55: Drift Detection for Skills.
Tracks skills version changes across runs.
"""
import json
import hashlib
from typing import Dict, Any, Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel
import structlog

log = structlog.get_logger()

class DriftReport(BaseModel):
    changed: bool
    phase: str
    current_hash: str
    previous_hash: Optional[str]
    changed_skills: Dict[str, Dict[str, str]]  # {skill_id: {from: ver, to: ver}}
    added_skills: List[str]
    removed_skills: List[str]

def compute_skills_hash(skills_versions: Dict[str, str]) -> str:
    """Compute canonical hash of skills versions."""
    canonical = json.dumps(skills_versions, sort_keys=True)
    return hashlib.sha256(canonical.encode()).hexdigest()

def record_skills_run(run_id: str, phase: str, skills_versions: Dict[str, str]) -> None:
    """Record skills versions for a run."""
    from nuclear.db.sqlite import SQLiteEngine
    
    try:
        skills_hash = compute_skills_hash(skills_versions)
        skills_json = json.dumps(skills_versions, sort_keys=True)
        ts = datetime.now(timezone.utc).isoformat()
        
        with SQLiteEngine.transaction() as conn:
            conn.execute(
                """INSERT OR REPLACE INTO skills_runs 
                   (run_id, ts, phase, skills_hash, skills_json) 
                   VALUES (?, ?, ?, ?, ?)""",
                (run_id, ts, phase, skills_hash, skills_json)
            )
    except Exception as e:
        log.error("record_skills_run_failed", run_id=run_id, phase=phase, error=str(e))

def detect_drift(phase: str, current_skills: Dict[str, str]) -> DriftReport:
    """
    Detect drift by comparing current skills to last run.
    Non-blocking: returns report even on errors.
    """
    from nuclear.db.sqlite import SQLiteEngine
    
    current_hash = compute_skills_hash(current_skills)
    
    try:
        with SQLiteEngine.transaction() as conn:
            row = conn.execute(
                """SELECT skills_hash, skills_json FROM skills_runs 
                   WHERE phase = ? ORDER BY ts DESC LIMIT 1""",
                (phase,)
            ).fetchone()
            
            if not row:
                # No previous run
                return DriftReport(
                    changed=False,
                    phase=phase,
                    current_hash=current_hash,
                    previous_hash=None,
                    changed_skills={},
                    added_skills=list(current_skills.keys()),
                    removed_skills=[]
                )
            
            previous_hash = row[0]
            previous_json = row[1]
            previous_skills = json.loads(previous_json)
            
            if current_hash == previous_hash:
                return DriftReport(
                    changed=False,
                    phase=phase,
                    current_hash=current_hash,
                    previous_hash=previous_hash,
                    changed_skills={},
                    added_skills=[],
                    removed_skills=[]
                )
            
            # Compute diff
            changed_skills = {}
            added_skills = []
            removed_skills = []
            
            current_ids = set(current_skills.keys())
            previous_ids = set(previous_skills.keys())
            
            for skill_id in current_ids & previous_ids:
                if current_skills[skill_id] != previous_skills[skill_id]:
                    changed_skills[skill_id] = {
                        "from": previous_skills[skill_id],
                        "to": current_skills[skill_id]
                    }
            
            added_skills = list(current_ids - previous_ids)
            removed_skills = list(previous_ids - current_ids)
            
            return DriftReport(
                changed=True,
                phase=phase,
                current_hash=current_hash,
                previous_hash=previous_hash,
                changed_skills=changed_skills,
                added_skills=added_skills,
                removed_skills=removed_skills
            )
    except Exception as e:
        log.error("detect_drift_failed", phase=phase, error=str(e))
        return DriftReport(
            changed=False,
            phase=phase,
            current_hash=current_hash,
            previous_hash=None,
            changed_skills={},
            added_skills=[],
            removed_skills=[]
        )

def get_drift_history(phase: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Get recent drift records for a phase."""
    from nuclear.db.sqlite import SQLiteEngine
    
    try:
        with SQLiteEngine.transaction() as conn:
            rows = conn.execute(
                """SELECT run_id, ts, skills_hash, skills_json 
                   FROM skills_runs 
                   WHERE phase = ? 
                   ORDER BY ts DESC 
                   LIMIT ?""",
                (phase, limit)
            ).fetchall()
            
            return [
                {
                    "run_id": row[0],
                    "ts": row[1],
                    "skills_hash": row[2],
                    "skills": json.loads(row[3])
                }
                for row in rows
            ]
    except Exception as e:
        log.error("get_drift_history_failed", phase=phase, error=str(e))
        return []
