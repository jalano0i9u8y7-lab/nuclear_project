import structlog
from datetime import datetime, timezone
from typing import Dict, Any, List
from nuclear.phases.p25.p25_schemas import P25Output, ICDZRange, compute_icdz_confidence
from nuclear.phases.p25.p25_prompts import build_p25_analyst_prompt
from nuclear.risk.freeze_state import set_freeze # Assuming this exists or will be stubbed

log = structlog.get_logger()

def run_p25(
    ticker: str,
    p2_output: Dict[str, Any],
    run_id: str = "default",
    version_chain_id: str = "default"
) -> P25Output:
    """
    SSOT §7.5: P2.5 Institutional Smart Money Analysis.
    The "Lie Detector" phase.
    """
    log.info("Starting P2.5 Smart Money Analysis", ticker=ticker)

    # 1. Fetch Data (Stubs as per instructions)
    daily_data = _stub_fetch_daily_smart_money(ticker)
    quarterly_13f = _stub_fetch_13f_data(ticker)
    institutional_evidence = p2_output.get("institutional_evidence", []) # From P1-1.5

    # 2. Prompt Construction
    prompt = build_p25_analyst_prompt(ticker, p2_output, daily_data, quarterly_13f)

    # 3. LLM Execution (Stub)
    raw_ai_res = _stub_hermes_p25(ticker)

    # 4. ICDZ Confidence Calculation (SSOT §7.3.4)
    # Weights: completeness 40%, consistency 30%, price_validation 30%
    icdz_raw = raw_ai_res.get("icdz_range", {})
    confidence = compute_icdz_confidence(
        data_completeness=0.9, # Mock value
        institutional_consistency=0.8, # Mock value
        price_validation=0.7 # Mock value
    )
    icdz_obj = ICDZRange(
        lower=icdz_raw.get("lower"),
        upper=icdz_raw.get("upper"),
        confidence=confidence
    )

    # 5. Insider Alert Hard Trigger (SSOT §7.3.3)
    insider_alert = raw_ai_res.get("insider_alert", False)
    if insider_alert:
        log.warning("INSIDER ALERT TRIGGERED: Collective selling > 30%", ticker=ticker)
        # SSOT §7.3.3: Force BUY_FREEZE
        # set_freeze(ticker, datetime.now(timezone.utc).isoformat(), "P2.5", "BUY_FREEZE", "Insider collective selling >30%")

    # 6. Assembly
    p25_res = P25Output(
        ticker=ticker,
        smart_money_score=raw_ai_res.get("smart_money_score", 50.0),
        smart_money_direction=raw_ai_res.get("smart_money_direction", "NEUTRAL"),
        insider_alert=insider_alert,
        insider_alert_detail=raw_ai_res.get("insider_alert_detail"),
        abnormal_13f_alert=raw_ai_res.get("abnormal_13f_alert", False),
        hedge_fund_clone_signal=raw_ai_res.get("hedge_fund_clone_signal", "NEUTRAL"),
        icdz_range=icdz_obj,
        institutional_ownership_change=raw_ai_res.get("institutional_ownership_change"),
        rating_trend_score=raw_ai_res.get("rating_trend_score"),
        rating_divergence=raw_ai_res.get("rating_divergence"),
        snapshot_id=f"snap_p25_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
        version_chain_id=version_chain_id,
        run_id=run_id,
        created_at=datetime.now(timezone.utc).isoformat(),
        # Article 1 Fields
        future_projection=raw_ai_res.get("future_projection", {"direction": "NEUTRAL", "time_window": "4w", "confidence": 0.5, "key_drivers": []}),
        falsification_checkpoints=raw_ai_res.get("falsification_checkpoints", [{"signal": "NONE", "condition": "NONE", "timeline": "NONE", "severity": "MEDIUM"}]),
        verification_timeline=raw_ai_res.get("verification_timeline", {"next_review_date": "2026-06", "confidence_decay_rate": 0.1, "recheck_triggers": []}),
        failure_modes=raw_ai_res.get("failure_modes", [{"description": "NONE", "probability": "LOW", "early_warning_signal": ""}])
    )

    log.info("P2.5 completed", ticker=ticker, sm_direction=p25_res.smart_money_direction)
    return p25_res

def _stub_fetch_daily_smart_money(ticker: str) -> Dict:
    return {"accumulation_index": 0.65, "dark_pool_balance": 0.2}

def _stub_fetch_13f_data(ticker: str) -> Dict:
    return {"total_institutional_pct": 0.75, "buy_count": 120, "sell_count": 45}

def _stub_hermes_p25(ticker: str) -> Dict:
    """Mock Hermes 4 output for P2.5"""
    return {
        "smart_money_score": 82.0,
        "smart_money_direction": "ACCUMULATION",
        "insider_alert": False,
        "abnormal_13f_alert": False,
        "hedge_fund_clone_signal": "HIGH_CONVICTION_BUY",
        "icdz_range": {"lower": 135.0, "upper": 142.5},
        "institutional_ownership_change": 2.5,
        "future_projection": {"direction": "UP", "time_window": "13 weeks", "confidence": 0.8, "key_drivers": ["Institutional Support"]},
        "falsification_checkpoints": [{"signal": "13F Collective Exit", "condition": "Large funds selling", "timeline": "Next 13F cycle", "severity": "HIGH"}],
        "failure_modes": [{"description": "Volume mismatch", "probability": "LOW", "early_warning_signal": "Divergence"}]
    }
