"""
M03 History Reconciliation Layer (Read-Only).
Semantic Mapping: Infra support for Daily D-3 (Stock Unifier) and D-4 (Worldview Unifier).
This module ensures "Historian Iron Rules" (史官鐵律) by detecting structural breaks.
Not a phase by itself; runs as a pre-flight check for phases.
"""
import json
import structlog
from pathlib import Path
from typing import Any, List, Optional
from pydantic import BaseModel

from nuclear.db.sqlite import SQLiteEngine

log = structlog.get_logger()

class ReconciliationResult(BaseModel):
    window_size: int
    snapshots_used: List[str]
    continuity_status: str  # "ok" | "incomplete" | "broken"
    detected_breaks: List[str]
    summary: str

def load_recent_snapshots(phase: str, limit: int = 3) -> List[dict]:
    """Load metadata of recent snapshots from DB."""
    sql = """
    SELECT snapshot_id, payload_ref 
    FROM snapshots_index 
    WHERE phase = ? 
    ORDER BY created_at DESC 
    LIMIT ?
    """
    conn = SQLiteEngine.connect()
    try:
        rows = conn.execute(sql, (phase, limit)).fetchall()
    finally:
        conn.close()
    
    # Return as list of dicts
    return [{"snapshot_id": r[0], "payload_ref": r[1]} for r in rows]

def compare_structures(payloads: List[dict]) -> List[str]:
    """
    Compare a list of payloads (ordered DESC: current -> older).
    Returns list of break descriptions.
    """
    breaks = []
    if not payloads:
        return breaks
        
    latest = payloads[0]
    latest_keys = set(latest.keys())
    
    # Compare each payload against the LATEST (reference)
    # We want to know if older snapshots had different structure than what we have now (or vice versa).
    # "A break is detected ONLY if: Required WB-1 output keys are missing... Data type changes... Top-level schema shape changes"
    # This implies we check if the SEQUENCE is consistent.
    # If yesterday's structure differs from today's (latest), that counts as a break in continuity.
    
    for i, p in enumerate(payloads[1:], start=1):
        # 1. Check keys match
        current_keys = set(p.keys())
        missing_in_current = latest_keys - current_keys
        missing_in_latest = current_keys - latest_keys
        
        if missing_in_current:
            breaks.append(f"Snapshot -{i} missing keys present in latest: {missing_in_current}")
        if missing_in_latest:
            breaks.append(f"Snapshot -{i} has extra keys not in latest: {missing_in_latest}")
            
        # 2. Check types of common keys
        common_keys = latest_keys.intersection(current_keys)
        for k in common_keys:
            t1 = type(latest[k])
            t2 = type(p[k])
            if t1 != t2:
                # Allow int vs float
                if (t1 in [int, float]) and (t2 in [int, float]):
                    continue
                # Allow None if optional? Spec says "Data type of a key changes". 
                # Let's be strict for now: None vs Dict is a change.
                breaks.append(f"Key '{k}' type mismatch: {t1} vs {t2}")

    return breaks

def reconcile_history(phase: str = "wb1", window_size: int = 3) -> ReconciliationResult:
    """
    Main entry point. Reads DB -> Loads Payloads -> Compares -> Returns Result.
    Does NOT mutate anything.
    """
    snaps_meta = load_recent_snapshots(phase, window_size)
    
    result = ReconciliationResult(
        window_size=window_size,
        snapshots_used=[s["snapshot_id"] for s in snaps_meta],
        continuity_status="ok",
        detected_breaks=[],
        summary=""
    )
    
    if len(snaps_meta) < 1:
        result.continuity_status = "incomplete"
        result.summary = "No history found."
        return result
        
    # Load Payloads from Cold Storage
    payloads = []
    for meta in snaps_meta:
        path = Path(meta["payload_ref"])
        if not path.exists():
            result.continuity_status = "broken"
            result.detected_breaks.append(f"Payload missing on disk: {path}")
            result.summary = "Critical: Snapshot payload missing."
            return result
            
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            payloads.append(data)
        except json.JSONDecodeError:
            result.continuity_status = "broken"
            result.detected_breaks.append(f"Invalid JSON in {path}")
            result.summary = "Critical: Corrupt snapshot payload."
            return result

    # Compare
    structural_breaks = compare_structures(payloads)
    
    if structural_breaks:
        result.continuity_status = "broken"
        result.detected_breaks.extend(structural_breaks)
        result.summary = f"Detected {len(structural_breaks)} structural break(s) in last {len(payloads)} snapshots."
    elif len(payloads) < window_size:
        result.continuity_status = "incomplete"
        result.summary = f"Continuity OK but only found {len(payloads)}/{window_size} snapshots."
    else:
        result.continuity_status = "ok"
        result.summary = f"No structural break detected across last {window_size} {phase} snapshots."
        
    return result
