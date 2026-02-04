import pytest
import sqlite3
import json
from pathlib import Path
from datetime import datetime, timezone
from contextlib import closing

from nuclear.learning.schemas import (
    LearningStateLatest, 
    LearningPolicyHardCap, 
    LearningPolicySoftBias, 
    LearningPolicyBannedPattern
)
from nuclear.learning.state import save_learning_state, load_learning_state_latest
from nuclear.db.schema import create_tables
from nuclear.db.sqlite import SQLiteEngine

DB_PATH = Path("outputs/nuclear.db")

@pytest.fixture
def clean_db():
    if DB_PATH.exists():
        DB_PATH.unlink()
    # Re-init tables
    create_tables()
    yield
    # No cleanup needed for manual debug

def test_learning_state_roundtrip(clean_db):
    """Test saving and loading a full state object."""
    
    # 1. Create a dummy state
    now_iso = datetime.now(timezone.utc).isoformat()
    
    cap = LearningPolicyHardCap(
        policy_id="p1",
        level="system",
        rule="max_exposure=30%",
        evidence=["case_123"],
        confidence=0.9,
        ttl_days=30,
        generated_at=now_iso
    )
    
    bias = LearningPolicySoftBias(
        policy_id="p2",
        level="sector",
        rule="tech_weight_-10%",
        evidence=["case_456"],
        confidence=0.7,
        ttl_days=14,
        generated_at=now_iso
    )
    
    ban = LearningPolicyBannedPattern(
        policy_id="p3",
        level="symbol",
        signature="vol_spike_and_reversal",
        action="DISALLOW",
        evidence=["case_789"],
        confidence=0.95,
        ttl_days=60,
        generated_at=now_iso
    )
    
    state = LearningStateLatest(
        version=1,
        generated_at=now_iso,
        context_signature_summary="test_context_sig",
        policy_hard_caps=[cap],
        policy_soft_bias=[bias],
        policy_banned_patterns=[ban],
        fail_signatures_topK=["sig1", "sig2"],
        data_gap_watchlist=["gap1"],
        evidence_index=["ev1"],
        ttl_days=30,
        half_life_days=15
    )
    
    # 2. Save
    try:
        res = save_learning_state(state)
        assert res["status"] == "saved"
        assert res["version"] == 1
        
        # 3. Load
        loaded = load_learning_state_latest()
        assert loaded is not None
        assert loaded.version == 1
        assert loaded.context_signature_summary == "test_context_sig"
        assert len(loaded.policy_hard_caps) == 1
        assert loaded.policy_hard_caps[0].policy_id == "p1"
        assert len(loaded.policy_banned_patterns) == 1
        assert loaded.policy_banned_patterns[0].signature == "vol_spike_and_reversal"
    except Exception as e:
        print(f"\\n\\nCAUGHT EXCEPTION: {e}\\n\\n")
        raise

def test_append_only_log(clean_db):
    """Verify that updating state appends to log."""
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # Version 1
    state1 = LearningStateLatest(
        version=1, generated_at=now_iso, context_signature_summary="v1",
        policy_hard_caps=[], policy_soft_bias=[], policy_banned_patterns=[],
        fail_signatures_topK=[], data_gap_watchlist=[], evidence_index=[],
        ttl_days=1, half_life_days=1
    )
    save_learning_state(state1)
    
    # Version 2
    state2 = state1.model_copy(update={"version": 2, "context_signature_summary": "v2"})
    save_learning_state(state2)
    
    # Check "Latest" table has only v2
    loaded = load_learning_state_latest()
    assert loaded.version == 2
    
    # Check "Log" table has 2 entries
    with closing(SQLiteEngine.connect()) as conn:
        count = conn.execute("SELECT count(*) FROM learning_state_log").fetchone()[0]
        assert count == 2
        
        # Verify content
        rows = conn.execute("SELECT version FROM learning_state_log ORDER BY version ASC").fetchall()
        assert rows[0][0] == 1
        assert rows[1][0] == 2

def test_sqlite_connection_closes(clean_db):
    """Ensure safe connection handling (Windows lock check)."""
    now_iso = datetime.now(timezone.utc).isoformat()
    state = LearningStateLatest(
        version=1, generated_at=now_iso, context_signature_summary="lock_test",
        policy_hard_caps=[], policy_soft_bias=[], policy_banned_patterns=[],
        fail_signatures_topK=[], data_gap_watchlist=[], evidence_index=[],
        ttl_days=1, half_life_days=1
    )
    
    # Save repeatedly
    for _ in range(5):
        save_learning_state(state)
    
    # Load repeatedly
    for _ in range(5):
        load_learning_state_latest()
        
    # Attempt to unlink DB to prove it's not locked
    try:
        if DB_PATH.exists():
            DB_PATH.unlink()
    except PermissionError:
        pytest.fail("Database file is locked! Connection leak detected.")
