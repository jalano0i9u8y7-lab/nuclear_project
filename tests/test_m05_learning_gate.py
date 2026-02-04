import pytest
import sqlite3
import json
import uuid
import structlog
from pathlib import Path
from datetime import datetime, timezone
from contextlib import closing

from nuclear.learning.gate import load_learning_gate, LearningGateContext
from nuclear.learning.state import save_learning_state, load_learning_state_latest
from nuclear.learning.schemas import LearningStateLatest, LearningPolicyHardCap
from nuclear.phases.weekly.wb1 import run_wb1_macro
from nuclear.phases.weekly.wb2 import run_wb2_and_persist
from nuclear.db.schema import create_tables
from nuclear.db.sqlite import SQLiteEngine

DB_PATH = Path("outputs/nuclear.db")

@pytest.fixture
def clean_db():
    if DB_PATH.exists():
        DB_PATH.unlink()
    create_tables()
    yield

def test_learning_gate_load_empty(clean_db):
    """Test loading gate when no state exists."""
    gate = load_learning_gate()
    assert gate.learning_version == 0
    assert gate.hard_caps_count == 0
    assert gate.enforcement_mode == "off"

def test_learning_gate_load_seeded(clean_db):
    """Test loading gate with populated state."""
    # Seed state
    now_iso = datetime.now(timezone.utc).isoformat()
    cap = LearningPolicyHardCap(
        policy_id="p1", level="symbol", rule="no_buy",
        evidence=[], confidence=1.0, ttl_days=1, generated_at=now_iso
    )
    state = LearningStateLatest(
        version=5, generated_at=now_iso, context_signature_summary="test",
        policy_hard_caps=[cap], policy_soft_bias=[], policy_banned_patterns=[],
        fail_signatures_topK=[], data_gap_watchlist=[], evidence_index=[],
        ttl_days=1, half_life_days=1
    )
    save_learning_state(state)
    
    # Load Gate
    gate = load_learning_gate()
    assert gate.learning_version == 5
    assert gate.hard_caps_count == 1
    assert gate.enforcement_mode == "off"
    assert "v5|caps=1" in gate.summary_signature

def test_wb1_integration(clean_db, caplog):
    """Verify WB1 loads gate and logs it."""
    run_id = str(uuid.uuid4())
    inputs = {"run_id": run_id}
    
    from structlog.testing import capture_logs
    with capture_logs() as captured:
        run_wb1_macro(inputs)
        
    # Check for log message
    found = False
    for log in captured:
        if log.get("event") == "learning_gate_loaded" and log.get("phase") == "wb1":
            found = True
            assert log.get("enforcement_mode") == "off"
            break
    assert found, "WB1 did not log learning_gate_loaded"

def test_wb2_integration(clean_db, caplog):
    """Verify WB2 loads gate and logs it."""
    # Setup WB1 output
    Path("outputs").mkdir(parents=True, exist_ok=True)
    wb1_out = {
        "worldview_version": "v1",
        "world_state_snapshot": {},
        "asset_identity_map": {}, 
        "narrative_map": {},
        "identity_shift_signals_summary": {},
        "rebuild_recommendation": False
    }
    Path("outputs/wb1_output.json").write_text(json.dumps(wb1_out))
    
    from structlog.testing import capture_logs
    with capture_logs() as captured:
        run_wb2_and_persist(run_context={"run_id": "test_run"})
        
    found = False
    for log in captured:
        if log.get("event") == "learning_gate_loaded" and log.get("phase") == "wb2":
            found = True
            assert log.get("enforcement_mode") == "off"
            break
    assert found, "WB2 did not log learning_gate_loaded"

def test_behavior_unchanged(clean_db):
    """Ensure output is exactly what it was before (stub behavior)."""
    # WB1
    out1 = run_wb1_macro({"run_id": "test"})
    assert out1["worldview_version"] == "stub_v1"
    
    # WB2
    # Pre-req: wb1 output file
    Path("outputs/wb1_output.json").write_text(json.dumps(out1))
    orders = run_wb2_and_persist(run_context={"run_id": "test"})
    assert len(orders) == 1
    assert orders[0].ticker == "SPY"
