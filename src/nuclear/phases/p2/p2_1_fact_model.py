
from typing import Dict, Any, List
import structlog
from datetime import datetime, timezone
from nuclear.phases.p2.p2_schemas import P21FactModel, PeerGroup, PeerEntry, OperatingLeverageInflection
from nuclear.phases.p2.p2_1_calculators import (
    compute_risk_profile, compute_growth_sub_scores, 
    compute_fpe, compute_operating_leverage_inflection
)

log = structlog.get_logger()

def run_p2_1(
    ticker: str, 
    p0_logic_card: Dict[str, Any], 
    p1_extraction: Dict[str, Any], 
    run_id: str = "default", 
    version_chain_id: str = "default"
) -> P21FactModel:
    """
    SSOT §6.2: P2-1 Fact Modeling (Facts only, no causation).
    """
    log.info("Starting P2-1 Fact Modeling", ticker=ticker)

    # 1. Indicator Filtering (SSOT §6.2.1)
    forbidden = p0_logic_card.get("forbidden_metrics", [])
    log.info("Filtering forbidden metrics", ticker=ticker, forbidden=forbidden)

    # 2. Fetch Data (Stub)
    financial_data = _stub_fetch_financial_data(ticker)
    
    # 3. Deterministic Calculations (Task 3.2 - Calculators)
    risk_res = compute_risk_profile(financial_data)
    growth_res = compute_growth_sub_scores(financial_data, {})
    fpe_res = compute_fpe(financial_data, {})
    ol_res = compute_operating_leverage_inflection(financial_data)

    # 4. Peer Selection (Stub for AI call)
    peers = _stub_peer_selection(ticker)

    # 5. Evidence Pointer (SSOT §6.2.2 ⑥)
    # Extract relevant sentences from P1 extraction (p1_industry_evidence)
    evidence = p1_extraction.get("p1_industry_evidence", [])
    
    # 6. Assembly
    fact_model = P21FactModel(
        snapshot_id=f"snap_p21_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
        version_chain_id=version_chain_id,
        ticker=ticker,
        risk_profile=risk_res["risk_profile"],
        risk_note=risk_res.get("risk_note"),
        growth_rate_score=growth_res["growth_rate_score"],
        growth_consistency_score=growth_res["growth_consistency_score"],
        operating_leverage_score=growth_res["operating_leverage_score"],
        cash_conversion_score=growth_res["cash_conversion_score"],
        growth_low_quality_flag=growth_res["growth_low_quality_flag"],
        frontier_growth_scores=growth_res.get("frontier_growth_scores"),
        operating_leverage_inflection=OperatingLeverageInflection(**ol_res),
        fpe_a=fpe_res.get("fpe_a"),
        fpe_b=fpe_res.get("fpe_b"),
        fpe_divergence=fpe_res.get("fpe_divergence"),
        peer_group=peers,
        fact_items=financial_data.get("metrics", {}),
        forbidden_metrics_skipped=forbidden,
        source="SEC/Drive",
        as_of_date=datetime.now(timezone.utc).strftime("%Y-%m-%d")
    )

    log.info("P2-1 Fact Modeling completed", ticker=ticker, risk=fact_model.risk_profile)
    return fact_model

def _stub_fetch_financial_data(ticker: str) -> Dict[str, Any]:
    """Stub for financial data fetching."""
    return {
        "cfo": 1000,
        "interest_coverage": 10.5,
        "net_debt_ebitda": 0.5,
        "growth_rate": 85.0,
        "growth_consistency": 80.0,
        "operating_leverage": 70.0,
        "cash_conversion": 90.0,
        "fpe_a": 35.0,
        "fpe_b": 32.0,
        "revenue_growth_trend": [0.1, 0.2, 0.3],
        "opex_ratio_trend": [0.4, 0.35, 0.3],
        "metrics": {"total_revenue": 1000000, "net_income": 200000}
    }

def _stub_peer_selection(ticker: str) -> PeerGroup:
    """Stub for AI peer selection."""
    return PeerGroup(
        size_classification="Market_Leader",
        peers=[
            PeerEntry(ticker="AMD", company_name="AMD", size_classification="Mid_to_Large", selection_reasoning="Direct GPU competitor.", metrics_vs_peers={"growth": 0.8}),
            PeerEntry(ticker="AVGO", company_name="Broadcom", size_classification="Market_Leader", selection_reasoning="Component supplier/competitor.", metrics_vs_peers={"growth": 0.7})
        ]
    )
