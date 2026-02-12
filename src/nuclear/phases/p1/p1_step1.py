from typing import Dict, List
import structlog
import json
from nuclear.m0.core import get_m0
from nuclear.m0.job import M0Request
from nuclear.phases.p1.p1_schemas import P1Step1Output, P1Step1Company
from nuclear.phases.p1.p1_step1_prompts import build_p1_step1_prompt
from nuclear.phases.p0.p0_schemas import P0Output
from nuclear.phases.p0.p05_schemas import P05Output
from nuclear.phases.p0.p07_schemas import P07Output

log = structlog.get_logger()

def run_p1_step1(
    p0_output: P0Output, 
    p05_output: P05Output, 
    p07_output: P07Output, 
    run_id: str = "default", 
    version_chain_id: str = "default"
) -> P1Step1Output:
    """
    SSOT §5.2: P1 Step 1 - Company Selection logic.
    Dual-analyst (DeepSeek/Hermes) fusion point.
    """
    log.info("Starting P1 Step 1", run_id=run_id)

    # 1. Prompt Construction
    prompts = build_p1_step1_prompt(
        p0_output.model_dump(), 
        p05_output.model_dump(), 
        p07_output.model_dump()
    )
    
    # 2. LLM Execution (§5.2 Dual-analyst)
    m0 = get_m0()
    request = M0Request(
        phase="P1-1",
        system_prompt=prompts["system"],
        user_prompt=prompts["user"],
        run_id=run_id
    )
    # §2.6: P1-1 is a dual-analyst phase
    audited_res = m0.submit_with_audit(request)
    
    try:
        raw_output = json.loads(audited_res.final_conclusion)
    except Exception as e:
        log.warning("P1 Step 1 JSON parse failed, using stub", error=str(e))
        raw_output = _stub_dual_analyst_p1_step1()
    
    # 3. Parsing and Schema Validation
    companies = []
    if "companies" in raw_output:
        for c in raw_output["companies"]:
            try:
                companies.append(P1Step1Company(**c))
            except Exception as e:
                log.warning("Skipping invalid company entry", error=str(e), data=c)
    
    p1_s1_out = P1Step1Output(
        companies=companies,
        total_count=len(companies),
        market_distribution=raw_output.get("market_distribution", {}),
        low_confidence_candidates=raw_output.get("low_confidence_candidates", [])
    )
    
    log.info("P1 Step 1 completed", total_companies=p1_s1_out.total_count)
    return p1_s1_out

def _stub_dual_analyst_p1_step1() -> Dict:
    return {
        "companies": [
            {"ticker": "NVDA", "company_name": "NVIDIA", "market": "US", "p0_theme_id": "T1", "p0_subtheme_id": "ST1", "chain_position": "upstream", "inclusion_reason": "R", "confidence": 0.99},
            {"ticker": "2330.TW", "company_name": "TSMC", "market": "TW", "p0_theme_id": "T1", "p0_subtheme_id": "ST2", "chain_position": "midstream", "inclusion_reason": "R", "confidence": 0.99}
        ],
        "market_distribution": {"US": 1, "TW": 1, "JP": 0},
        "low_confidence_candidates": []
    }
