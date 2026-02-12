import structlog
from datetime import datetime, timezone
from typing import List, Dict, Any
from .p4_calculator import run_p4_calculation
from .p4_schemas import P4Output

log = structlog.get_logger()

def run_p4(
    stocks_data: List[Dict],
    p07_output: Dict,
    market_regime: str,
    defcon_level: int,
    identity_drift: bool,
    learning_state: Dict,
    current_positions: Dict, # Placeholder for future usage
    run_id: str = "default",
    version_chain_id: str = "default"
) -> P4Output:
    """
    SSOT §9.10: P4 Allocation Engine Main Entry.
    Purely deterministic calculation.
    """
    log.info("Starting P4 Allocation Engine", stock_count=len(stocks_data))
    
    # 執行純數學計算
    p4_result = run_p4_calculation(
        stocks=stocks_data,
        p07_output=p07_output,
        market_regime=market_regime,
        defcon_level=defcon_level,
        identity_drift=identity_drift,
        learning_state=learning_state
    )
    
    # 更新 snapshot metadata
    p4_result.snapshot_id = f"snap_p4_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    p4_result.version_chain_id = version_chain_id
    
    log.info("P4 Allocation completed", U_final=p4_result.U_final)
    return p4_result
