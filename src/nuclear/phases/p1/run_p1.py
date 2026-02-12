
import structlog
from nuclear.phases.p1.p1_schemas import P1Step2Output
from nuclear.phases.p1.p1_step1 import run_p1_step1
from nuclear.phases.p1.p1_extraction import run_extraction
from nuclear.phases.p1.p1_step2 import run_p1_step2
from nuclear.phases.p0.p0_schemas import P0Output
from nuclear.phases.p0.p05_schemas import P05Output
from nuclear.phases.p0.p07_schemas import P07Output

log = structlog.get_logger()

def run_p1(
    p0_output: P0Output, 
    p05_output: P05Output, 
    p07_output: P07Output, 
    run_id: str = "default", 
    version_chain_id: str = "default"
) -> P1Step2Output:
    """
    SSOT §5: P1 Individual Stock Analysis (The Filter) Main Entry Point.
    Full Pipeline: Selection -> Extraction -> Tiering.
    """
    log.info("Starting full P1 pipeline", run_id=run_id)

    # Step 1: Company Selection
    s1_output = run_p1_step1(p0_output, p05_output, p07_output, run_id, version_chain_id)
    
    # Extraction (Step 1.5): PDF/Report Evidence Extraction
    extractions = {}
    for comp in s1_output.companies:
        extractions[comp.ticker] = run_extraction(comp.ticker, comp.market, run_id)
        
    # Step 2: Alignment Check & Structural Tiering
    p1_output = run_p1_step2(
        s1_output, 
        p0_output, 
        p05_output, 
        p07_output, 
        extractions, 
        run_id, 
        version_chain_id
    )
    
    log.info("Full P1 pipeline completed", total_count=p1_output.total_count)
    return p1_output
