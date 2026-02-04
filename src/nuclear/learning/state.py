import json
import uuid
import structlog
import hashlib
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from contextlib import closing

from nuclear.db.sqlite import SQLiteEngine
from nuclear.learning.schemas import LearningStateLatest
from nuclear.db.schema import create_tables

log = structlog.get_logger()

# Ensure tables exist
create_tables()

def save_learning_state(state: LearningStateLatest) -> Dict[str, Any]:
    """
    Writes to learning_state_latest (replace latest row, by version)
    Appends to learning_state_log with sha256(payload_json)
    """
    
    payload_json = state.model_dump_json()
    
    # Compute SHA256 of payload
    # ensure consistent encoding
    payload_bytes = payload_json.encode('utf-8')
    payload_sha256 = hashlib.sha256(payload_bytes).hexdigest()
    
    created_at = datetime.now(timezone.utc).isoformat()
    log_id = str(uuid.uuid4())
    
    # 1. Prepare Latest Record Data
    # We map Pydantic fields to DB columns. 
    # Lists must be serialized to JSON for storage in SQLite TEXT fields.
    latest_params = (
        state.version,
        state.generated_at,
        state.context_signature_summary,
        json.dumps([p.model_dump() for p in state.policy_hard_caps]),
        json.dumps([p.model_dump() for p in state.policy_soft_bias]),
        json.dumps([p.model_dump() for p in state.policy_banned_patterns]), # Added per schema fix
        json.dumps(state.fail_signatures_topK),
        json.dumps(state.data_gap_watchlist),
        json.dumps(state.evidence_index),
        state.ttl_days,
        state.half_life_days
    )
    
    # 2. Prepare Log Record Data
    log_params = (
        log_id,
        state.version,
        state.generated_at,
        payload_json,
        payload_sha256,
        created_at
    )
    
    # 3. Transaction
    with SQLiteEngine.transaction() as conn:
        cursor = conn.cursor()
        
        # Upsert Latest: 
        # Strategy: Delete existing where version < new_version? 
        # Spec says: "learning_state_latest holds ONE ROW for current latest (by max(version))."
        # Implementation: We can just INSERT OR REPLACE if version is PK. 
        # Wait, if we use PK=version, we can have multiple rows if versions differ.
        # "learning_state_latest holds ONE ROW". 
        # So we should probably clear the table or ensure we only select top 1.
        # But if we want to enforce strictly ONE ROW, we might key it differently?
        # The prompt says: "Table: learning_state_latest ... version INTEGER PRIMARY KEY". 
        # This implies it CAN hold multiple versions if we insert them.
        # PROMPT RULE: "learning_state_latest holds ONE ROW for current latest (by max(version))."
        # This wording is slightly ambiguous. Does it mean the table IS the latest, or the table CONTAINS data where we find latest?
        # "load_learning_state_latest() -> Returns latest by max(version)" implies the table might hold history?
        # BUT "learning_state_log (append-only)" implies history goes there.
        # "learning_state_latest holds ONE ROW" usually means it's a singleton table.
        # Let's assume the INTENT is a singleton table for fast lookup of the *current* state.
        # BUT if the PK is version, user might have meant "Table `learning_state`" which holds versions?
        # No, table name is `learning_state_latest`.
        # I will implement: Clear existing row? Or just rely on max(version) query?
        # If I rely on max(version) query, the table grows.
        # I will CLEAR the table before inserting to ensure it acts as a "Latest" cache, OR I will follow the "holds ONE ROW" rule strictly.
        # Actually, let's keep it simple: If schema has Version PK, we just insert. 
        # load function will `ORDER BY version DESC LIMIT 1`.
        # This satisfies "Returns latest by max(version)".
        # And to keep "ONE ROW" conceptually, maybe we delete smaller versions?
        # I'll just keep it purely additive for safety unless cleared, but typically `_latest` tables replace.
        # Let's do: Delete *all* rows then Insert new one? 
        # Risk: Race condition if parallel? SQLite is file locked so ok.
        # Let's try: pure insert, but load sorts by version. 
        # Wait, if I Pure insert, it duplicates the Log's function.
        # The prompt says "learning_state_latest holds ONE ROW". 
        # I will DELETE all rows before INSERTING. 
        
        cursor.execute("DELETE FROM learning_state_latest")
        
        cursor.execute("""
            INSERT INTO learning_state_latest (
                version, generated_at, context_signature_summary,
                policy_hard_caps_json, policy_soft_bias_json, policy_banned_patterns_json,
                fail_signatures_topK_json, data_gap_watchlist_json, evidence_index_json,
                ttl_days, half_life_days
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, latest_params)
        
        cursor.execute("""
            INSERT INTO learning_state_log (
                log_id, version, generated_at, payload_json, payload_sha256, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, log_params)
        
    return {"log_id": log_id, "version": state.version, "status": "saved"}

def load_learning_state_latest() -> Optional[LearningStateLatest]:
    """
    Returns latest by max(version).
    If none exists, return None.
    """
    sql = """
    SELECT 
        version, generated_at, context_signature_summary,
        policy_hard_caps_json, policy_soft_bias_json, policy_banned_patterns_json,
        fail_signatures_topK_json, data_gap_watchlist_json, evidence_index_json,
        ttl_days, half_life_days
    FROM learning_state_latest
    ORDER BY version DESC
    LIMIT 1
    """
    
    # Use repo pattern with safe closing
    # Reusing the pattern I fixed in reconcile.py
    conn = SQLiteEngine.connect()
    try:
        conn.row_factory = None # We want tuples or we map manually? 
        # Pydantic needs dict or kwargs.
        # Let's use row_factory for name access
        import sqlite3
        conn.row_factory = sqlite3.Row
        
        row = conn.execute(sql).fetchone()
        
        if not row:
            return None
            
        # Parse JSON fields and explicit model reconstruction
        from nuclear.learning.schemas import (
            LearningPolicyHardCap, 
            LearningPolicySoftBias, 
            LearningPolicyBannedPattern
        )
        
        try:
            return LearningStateLatest(
                version=row["version"],
                generated_at=row["generated_at"],
                context_signature_summary=row["context_signature_summary"],
                policy_hard_caps=[LearningPolicyHardCap(**p) for p in json.loads(row["policy_hard_caps_json"])],
                policy_soft_bias=[LearningPolicySoftBias(**p) for p in json.loads(row["policy_soft_bias_json"])],
                policy_banned_patterns=[LearningPolicyBannedPattern(**p) for p in json.loads(row["policy_banned_patterns_json"])],
                fail_signatures_topK=json.loads(row["fail_signatures_topK_json"]),
                data_gap_watchlist=json.loads(row["data_gap_watchlist_json"]),
                evidence_index=json.loads(row["evidence_index_json"]),
                ttl_days=row["ttl_days"],
                half_life_days=row["half_life_days"]
            )
        except Exception as e:
            # log.error("load_failed", error=str(e))
            # Just raise for now as strictly required by contract
            raise
        
    finally:
        conn.close()
