
import structlog
from typing import Dict, Any
from nuclear.phases.p2.p2_schemas import Phase2Output
from nuclear.phases.p2.p2_1_fact_model import run_p2_1
from nuclear.phases.p2.p2_2_causal import run_p2_2

log = structlog.get_logger()

def run_p2(
    ticker: str, 
    p0_output: Dict[str, Any], 
    p05_output: Dict[str, Any], 
    p07_output: Dict[str, Any], 
    p1_company: Dict[str, Any], 
    p1_extraction: Dict[str, Any], 
    run_id: str = "default", 
    version_chain_id: str = "default"
) -> Phase2Output:
    """
    SSOT §6: P2 Fundamental Financial Analysis (The Fundamental Core) Entry Point.
    Pipeline: P2-1 (Fact Model) -> P2-2 (Causal 推論).
    """
    log.info("Starting full P2 pipeline", ticker=ticker, run_id=run_id)

    # 1. Logic Card extraction from P0
    # Assuming the first logic card is the relevant one for simplicity in this stubbed flow
    p0_logic_card = p0_output.get("industry_logic_cards", [{}])[0]

    # 2. Phase 2-1: Fact Modeling
    p21_model = run_p2_1(
        ticker, 
        p0_logic_card, 
        p1_extraction, 
        run_id, 
        version_chain_id
    )
    
    # 3. Phase 2-2: Causal 推論
    p22_output = run_p2_2(
        ticker, 
        p21_model, 
        p0_logic_card, 
        p05_output.get("handoff", {}), 
        p1_company, 
        p1_extraction, 
        p07_output,
        run_id, 
        version_chain_id
    )
    
    log.info("Full P2 pipeline completed", ticker=ticker, growth_grade=p22_output.growth_grade)
    return p22_output
