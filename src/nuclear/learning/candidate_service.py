import hashlib
import json
import uuid
import structlog
from typing import List, Any, Dict
from datetime import datetime, timezone
from contextlib import closing

from nuclear.db.sqlite import SQLiteEngine
from nuclear.learning.candidates import BaseCandidate
from nuclear.learning.observers.drawdown_observer import observe_drawdown
from nuclear.learning.observers.churn_observer import observe_churn

log = structlog.get_logger()

def generate_candidates(context: Dict[str, Any]) -> List[BaseCandidate]:
    """
    Run all observers to generate candidates.
    Context typically contains loaded historical snapshots/runs.
    """
    candidates = []
    
    # Run Observers (Pure functions)
    try:
        candidates.extend(observe_drawdown(context))
    except Exception as e:
        log.error("observer_failed", observer="drawdown", error=str(e))
        
    try:
        candidates.extend(observe_churn(context))
    except Exception as e:
        log.error("observer_failed", observer="churn", error=str(e))
        
    return candidates

def persist_candidates(candidates: List[BaseCandidate]) -> int:
    """
    Persist candidates to learning_candidates_log (Append-Only).
    Returns count of persisted items.
    """
    if not candidates:
        return 0
        
    count = 0
    created_at = datetime.now(timezone.utc).isoformat()
    
    with SQLiteEngine.transaction() as conn:
        cursor = conn.cursor()
        
        for cand in candidates:
            # Idempotency check? 
            # Spec says "append-only log". 
            # If candidate_id matches existing, we fail or skip?
            # Schema said PRIMARY KEY on candidate_id.
            # BaseCandidate has candidate_id. If observers regenerate same id, it will clash.
            # Observers should generate deterministic UUIDs? Or random?
            # Usually random. So purely additive.
            
            payload_json = cand.model_dump_json()
            payload_sha256 = hashlib.sha256(payload_json.encode('utf-8')).hexdigest()
            
            try:
                cursor.execute("""
                    INSERT INTO learning_candidates_log (
                        candidate_id, category, level, proposal, payload_json, payload_sha256, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (
                    cand.candidate_id,
                    cand.category,
                    cand.level,
                    cand.proposal,
                    payload_json,
                    payload_sha256,
                    created_at
                ))
                count += 1
            except Exception as e:
                log.error("persist_candidate_failed", id=cand.candidate_id, error=str(e))
                # Continue deciding if we abort batch or continue?
                # Let's continue.
                continue
                
    return count
