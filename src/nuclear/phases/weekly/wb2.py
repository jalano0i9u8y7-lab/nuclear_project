"""
WB-2 - order plan + order DSL.
SSOT V8.42: Each order must have worldview_version + identity_context; missing -> raise.
Reads WB1Output from outputs/wb1_output.json; writes orders to outputs/wb2_orders.json.
"""

import json
from pathlib import Path

from nuclear.models.schemas import IdentityContext, OrderPlan, WB1Output


def _validate_order(o: OrderPlan) -> None:
    """SSOT: missing worldview_version or identity_context must raise (no silent default)."""
    if not o.worldview_version or not o.identity_context:
        raise ValueError(
            "SSOT V8.42: Each order must have worldview_version and identity_context; "
            "missing values are not allowed."
        )


def load_wb1_output(path: str = "outputs/wb1_output.json") -> WB1Output:
    """Load WB1Output from JSON; raise with 請先執行 wb1 if file missing."""
    p = Path(path)
    if not p.exists():
        raise FileNotFoundError("outputs/wb1_output.json 不存在，請先執行 wb1。")
    data = json.loads(p.read_text(encoding="utf-8"))
    return WB1Output.model_validate(data)


def run_wb2_light(stocks: list, worldview: dict) -> list[OrderPlan]:
    """WB-2 light path: no escalation. worldview must have worldview_version."""
    wv = worldview.get("worldview_version")
    if not wv:
        raise ValueError("SSOT V8.42: worldview_version is required.")
    identity = IdentityContext(
        asset_id="SPY",
        identity_label="benchmark risk-on index",
        narrative="SPY currently behaves as benchmark risk-on index",
    )
    orders = [
        OrderPlan(
            ticker="SPY",
            worldview_version=wv,
            identity_context=identity,
            action="HOLD",
        )
    ]
    for o in orders:
        _validate_order(o)
    return orders


def run_wb2_heavy(stocks: list, worldview: dict, wa_report: dict) -> list[OrderPlan]:
    """WB-2 heavy path: escalation + W-A report."""
    return run_wb2_light(stocks, worldview)


def run_wb2_and_persist(
    wb1_path: str = "outputs/wb1_output.json",
    wb2_path: str = "outputs/wb2_orders.json",
    run_context: dict = None,
) -> list[OrderPlan]:
    """Load WB1, produce at least 1 order, write to wb2_orders.json; return orders."""
    wb1 = load_wb1_output(wb1_path)
    worldview = {"worldview_version": wb1.worldview_version}
    orders = run_wb2_light([], worldview)
    out_path = Path(wb2_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps([o.model_dump(mode="json") for o in orders], indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    # --- M01 Snapshot Integration (Start) ---
    from nuclear.storage.snapshot import SnapshotWriter
    # Convert models to dict/list for snapshot payload
    payload = [o.model_dump(mode="json") for o in orders]
    # M02: Capture run_id
    run_id = (run_context or {}).get("run_id", "default_run")
    
    # --- M05 Learning Gate (Read-Only) ---
    from nuclear.learning.gate import load_learning_gate
    import structlog
    log = structlog.get_logger()
    gate = load_learning_gate()
    log.info("learning_gate_loaded", 
             phase="wb2", 
             learning_version=gate.learning_version, 
             enforcement_mode=gate.enforcement_mode,
             summary=gate.summary_signature)
    # -------------------------------------

    SnapshotWriter().save(phase="wb2", payload=payload, run_id=run_id)
    # --- M01 Snapshot Integration (End) ---

    # --- M06 Soft Enforcement Sandbox (Shadow Mode) ---
    try:
        from nuclear.learning.state import load_learning_state_latest
        from nuclear.learning.shadow import run_shadow_enforcement
        # Per spec: Pass a COPY of orders
        orders_copy = [o.model_copy(deep=True) for o in orders]
        state = load_learning_state_latest()
        run_shadow_enforcement(orders_copy, state, run_id)
    except Exception as e:
        # Shadow failure must NOT impact main flow
        log.error("shadow_enforcement_failed", error=str(e))
    # --------------------------------------------------

    return orders
