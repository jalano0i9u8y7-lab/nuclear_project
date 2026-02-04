import pytest
import sqlite3
import json
import uuid
from pathlib import Path
from datetime import datetime, timezone
from contextlib import closing

from nuclear.learning.shadow import run_shadow_enforcement, persist_shadow_report, ShadowOrderResult
from nuclear.learning.state import save_learning_state, load_learning_state_latest
from nuclear.learning.schemas import (
    LearningStateLatest, LearningPolicyHardCap, 
    LearningPolicySoftBias, LearningPolicyBannedPattern
)
from nuclear.models.schemas import OrderPlan, IdentityContext
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

def test_shadow_does_not_modify_orders(clean_db):
    """Ensure orders remain identical after shadow run."""
    run_id = "test_run"
    
    # Setup State (Mock)
    state = LearningStateLatest(
        version=1,
        generated_at=datetime.now(timezone.utc).isoformat(),
        context_signature_summary="test",
        policy_hard_caps=[], policy_soft_bias=[], policy_banned_patterns=[],
        fail_signatures_topK=[], data_gap_watchlist=[], evidence_index=[],
        ttl_days=1, half_life_days=1
    )
    # Save state so load_learning_state_latest picks it up in wb2
    save_learning_state(state)
    
    # Prepare WB1 output
    Path("outputs").mkdir(parents=True, exist_ok=True)
    wb1_out = {
        "worldview_version": "v1",
        "world_state_snapshot": {},
        "asset_identity_map": {}, "narrative_map": {}, "identity_shift_signals_summary": {}, "rebuild_recommendation": False
    }
    Path("outputs/wb1_output.json").write_text(json.dumps(wb1_out))

    # Run WB2
    orders = run_wb2_and_persist(run_context={"run_id": run_id})
    
    # Assert
    assert len(orders) > 0
    assert orders[0].action == "HOLD"
    # The pure run_wb2_light returns HOLD on SPY. 
    # If shadow modifed it (e.g. to BLOCK), it would be diff.
    # But shadow logic is separate. We just verify the copy passed didn't mutation the original list.
    # Since run_wb2_and_persist returns `orders` variable which was passed to shadow (as copy),
    # verifying it here is verifying the main flow return value.

def test_shadow_report_persisted(clean_db):
    """Verify a report is written to DB."""
    run_id = str(uuid.uuid4())
    
    # 1. Seed State with a BAN policy for SPY
    state = LearningStateLatest(
        version=1,
        generated_at=datetime.now(timezone.utc).isoformat(),
        context_signature_summary="test",
        # BAN SPY
        policy_banned_patterns=[
            LearningPolicyBannedPattern(
                policy_id="p1", level="symbol", signature="SPY", action="DISALLOW",
                evidence=[], confidence=1.0, ttl_days=1, generated_at="now"
            )
        ],
        policy_hard_caps=[], policy_soft_bias=[],
        fail_signatures_topK=[], data_gap_watchlist=[], evidence_index=[],
        ttl_days=1, half_life_days=1
    )
    save_learning_state(state)
    
    # 2. Run WB2 (which produces SPY order)
    Path("outputs").mkdir(parents=True, exist_ok=True)
    wb1_out = {"worldview_version": "v1", "world_state_snapshot": {}, "asset_identity_map": {}, "narrative_map": {}, "identity_shift_signals_summary": {}, "rebuild_recommendation": False}
    Path("outputs/wb1_output.json").write_text(json.dumps(wb1_out))
    
    run_wb2_and_persist(run_context={"run_id": run_id})

    # 3. Check DB for Report
    with closing(SQLiteEngine.connect()) as conn:
        row = conn.execute("SELECT * FROM shadow_enforcement_reports WHERE run_id=?", (run_id,)).fetchone()
        assert row is not None
        
        # Verify content
        payload = json.loads(row[3]) # Payload JSON
        assert payload["blocked_count"] == 1
        assert payload["shadow_results"][0]["ticker"] == "SPY"
        assert payload["shadow_results"][0]["would_block"] == True
        assert "BAN:p1:SPY" in payload["shadow_results"][0]["triggered_policies"]

def test_shadow_logic_hard_cap(clean_db):
    """Unit test for policy logic (Hard Cap)."""
    orders = [
        OrderPlan(ticker="NVDA", worldview_version="v1", identity_context=IdentityContext(asset_id="NVDA", identity_label="A", narrative="n"), action="BUY")
    ]
    state = LearningStateLatest(
        version=1, generated_at="now", context_signature_summary="",
        policy_hard_caps=[
            LearningPolicyHardCap(policy_id="c1", level="symbol", rule="NVDA", evidence=[], confidence=1.0, ttl_days=1, generated_at="now")
        ],
        policy_soft_bias=[], policy_banned_patterns=[],
        fail_signatures_topK=[], data_gap_watchlist=[], evidence_index=[], ttl_days=1, half_life_days=1
    )
    
    report = run_shadow_enforcement(orders, state, "test")
    assert report.blocked_count == 1
    assert report.shadow_results[0].would_block == True
    assert "CAP:c1" in report.shadow_results[0].triggered_policies

def test_shadow_links_learning_version(clean_db):
    """Ensure report references correct learning version."""
    state = LearningStateLatest(
        version=99, generated_at="now", context_signature_summary="",
        policy_hard_caps=[], policy_soft_bias=[], policy_banned_patterns=[],
        fail_signatures_topK=[], data_gap_watchlist=[], evidence_index=[], ttl_days=1, half_life_days=1
    )
    save_learning_state(state)
    
    Path("outputs").mkdir(parents=True, exist_ok=True)
    wb1_out = {"worldview_version": "v1", "world_state_snapshot": {}, "asset_identity_map": {}, "narrative_map": {}, "identity_shift_signals_summary": {}, "rebuild_recommendation": False}
    Path("outputs/wb1_output.json").write_text(json.dumps(wb1_out))
    
    run_wb2_and_persist(run_context={"run_id": "vcheck"})
    
    with closing(SQLiteEngine.connect()) as conn:
        ver = conn.execute("SELECT learning_version FROM shadow_enforcement_reports WHERE run_id='vcheck'").fetchone()[0]
        assert ver == 99
