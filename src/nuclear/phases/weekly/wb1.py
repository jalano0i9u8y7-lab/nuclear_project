"""
WB-1 - worldview + stocks synthesis + identity_context.
SSOT V8.42: Output contract must include worldview_version, world_state_snapshot,
asset_identity_map, narrative_map, identity_shift_signals_summary, framework_stability_score,
rebuild_recommendation, rebuild_reason_top5.
"""

from typing import Any

from nuclear.models.schemas import WB1Output


def run_wb1_macro(worldview_input: dict[str, Any], reconciliation_context: dict = None) -> dict[str, Any]:
    """
    WB-1 macro: worldview snapshot, identity map. 
    M03: reconciliation_context is READ-ONLY for reference.
    """
    out = WB1Output(
        worldview_version="stub_v1",
        world_state_snapshot={},
        asset_identity_map={},
        narrative_map={},
        identity_shift_signals_summary={},
        framework_stability_score=None,
        rebuild_recommendation=False,
        rebuild_reason_top5=[],
    )
    # --- M01 Snapshot Integration (Start) ---
    # --- M01 Snapshot Integration (Start) ---
    from nuclear.storage.snapshot import SnapshotWriter
    # M02: Capture run_id from input
    run_id = worldview_input.get("run_id", "default_run")
    
    # --- M05 Learning Gate (Read-Only) ---
    from nuclear.learning.gate import load_learning_gate
    import structlog
    log = structlog.get_logger()
    gate = load_learning_gate()
    log.info("learning_gate_loaded", 
             phase="wb1", 
             learning_version=gate.learning_version, 
             enforcement_mode=gate.enforcement_mode,
             summary=gate.summary_signature)
    # -------------------------------------

    SnapshotWriter().save(phase="wb1", payload=out.model_dump(), run_id=run_id)
    # --- M01 Snapshot Integration (End) ---

    return out.model_dump()


def run_wb1_stocks(stocks_input: dict[str, Any]) -> dict[str, Any]:
    """WB-1 stocks: per-stock state snapshot, escalation判定."""
    return {"stocks": [], "escalation_list": []}
