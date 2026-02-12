import structlog
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from nuclear.phases.p3.p3_schemas import P3Output, BuyPrices, StopPrices, PriceLevel
from nuclear.phases.p3.p3_prompts import build_p3_analyst_prompt

log = structlog.get_logger()

def compute_risk_overlay_level(p07_output: Dict, p05_output: Dict) -> int:
    """
    SSOT §8.4.2 Risk Overlay Level 判定
    多條件同時存在時：取 max(all triggered levels)
    """
    levels = [0]
    
    time_position = p07_output.get("time_position", "")
    turning_point_risk = p07_output.get("turning_point_risk", "")
    loop_dominance = p07_output.get("loop_dominance", "")
    
    if time_position == "LATE" or turning_point_risk == "HIGH":
        levels.append(3)
    if loop_dominance == "BALANCING":
        levels.append(2)
    
    p05_flags = p05_output.get("handoff", {}).get("p5_weekly_flags", {})
    if p05_flags.get("INVENTORY_BUILD_WARNING"):
        levels.append(2)
    if p05_flags.get("LATE_CYCLE_RISK"):
        levels.append(1)
    
    return max(levels)

def compute_valuation_flag(fpe_b_vs_peers_pct: Optional[float], cat: int, risk_profile: str, fpe_divergence: Optional[float]) -> str:
    """
    SSOT §8.4.6 FPE 整合
    """
    if fpe_b_vs_peers_pct and fpe_b_vs_peers_pct > 90 and cat == 3:
        return "VALUATION_STRETCHED"
    if fpe_b_vs_peers_pct and fpe_b_vs_peers_pct < 20 and cat == 1 and risk_profile == "SAFE":
        return "VALUATION_ATTRACTIVE"
    if fpe_divergence and abs(fpe_divergence) > 0.20:
        return "FPE_DIVERGENCE_ALERT"
    return "NONE"

def check_boomerang(p2_output: Dict, cat: int, price_data: Dict, icdz: Optional[Dict]) -> Dict:
    """
    SSOT §8.4.4 迴力鏢協議 (Stub)
    """
    return {"re_entry_signal": False, "re_entry_price": None, "re_entry_qualification": None}

def run_p3(
    ticker: str,
    p2_output: Dict[str, Any],
    p25_output: Dict[str, Any],
    p07_output: Dict[str, Any],
    p05_output: Dict[str, Any],
    ohlcv_data: Dict[str, Any],
    indicators: Dict[str, Any],
    run_id: str = "default",
    version_chain_id: str = "default"
) -> P3Output:
    """
    SSOT §8.6: P3 Strategy Skeleton Main Logic.
    """
    log.info("Starting P3 Strategy Skeleton Analysis", ticker=ticker)

    # 1. Deterministic Calculations
    risk_level = compute_risk_overlay_level(p07_output, p05_output)
    
    # 2. Prompt Construction
    prompt = build_p3_analyst_prompt(ticker, p2_output, p25_output, ohlcv_data, indicators)

    # 3. LLM Execution (Stub)
    raw_ai_res = _stub_hermes_p3(ticker)
    
    cat = raw_ai_res.get("cat", 1)
    
    # 4. Valuation Flag
    val_flag = compute_valuation_flag(
        p2_output.get("fpe_b_vs_peers_percentile"),
        cat,
        p2_output.get("risk_profile", "SAFE"),
        p2_output.get("fpe_divergence")
    )

    # 5. Boomerang
    boomerang = check_boomerang(p2_output, cat, ohlcv_data, p25_output.get("icdz_range"))

    # 6. Alpha Exemption Check (§8.4.1a)
    # Future=S + mispricing=structural_repricing + conviction>=HIGH
    f_grade = p2_output.get("future_breakout_grade", "")
    m_types = p2_output.get("mispricing_type", [])
    conviction = p2_output.get("p0_conviction_level", "")
    
    alpha_exempt = (f_grade == "S" and "structural_repricing" in m_types and conviction in ["HIGH", "ULTRA_HIGH"])

    # 7. Assembly
    p3_res = P3Output(
        ticker=ticker,
        cat=cat,
        cat_confidence=raw_ai_res.get("cat_confidence", 0.8),
        cat_reasoning=raw_ai_res.get("cat_reasoning", "Bullish structure"),
        cat_reversal_evidence=raw_ai_res.get("cat_reversal_evidence"),
        support_levels=[PriceLevel(**lvl) for lvl in raw_ai_res.get("support_levels", [])],
        resistance_levels=[PriceLevel(**lvl) for lvl in raw_ai_res.get("resistance_levels", [])],
        trend_structure=raw_ai_res.get("trend_structure", "NEUTRAL"),
        icdz_applied=p25_output.get("icdz_range") is not None,
        icdz_range=p25_output.get("icdz_range"),
        risk_overlay_level=risk_level,
        distortion_risk=raw_ai_res.get("distortion_risk", "NONE"),
        rs_score_5d=raw_ai_res.get("rs_score_5d"),
        rs_score_20d=raw_ai_res.get("rs_score_20d"),
        re_entry_signal=boomerang["re_entry_signal"],
        re_entry_price=boomerang["re_entry_price"],
        fpe_a=p2_output.get("fpe_a"),
        fpe_b=p2_output.get("fpe_b"),
        fpe_b_vs_peers_pct=p2_output.get("fpe_b_vs_peers_percentile"),
        fpe_divergence=p2_output.get("fpe_divergence"),
        valuation_flag=val_flag,
        buy_prices=BuyPrices(**raw_ai_res.get("buy_prices", {"buy2": 100})),
        stop_prices=StopPrices(**raw_ai_res.get("stop_prices", {"stop1": 90})),
        weekly_trend=raw_ai_res.get("weekly_trend", "UP"),
        volume_profile=raw_ai_res.get("volume_profile", "ACCUMULATION"),
        alpha_exempt=alpha_exempt,
        next_delta_run_date=(datetime.now(timezone.utc)).isoformat(), # Mock
        snapshot_id=f"snap_p3_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
        version_chain_id=version_chain_id,
        run_id=run_id,
        created_at=datetime.now(timezone.utc).isoformat(),
        # Article 1
        future_projection=raw_ai_res.get("future_projection", {"direction": "UP", "time_window": "P3-Skeleton", "confidence": 0.5, "key_drivers": []}),
        falsification_checkpoints=raw_ai_res.get("falsification_checkpoints", [{"signal": "NONE", "condition": "NONE", "timeline": "NONE", "severity": "MEDIUM"}]),
        verification_timeline=raw_ai_res.get("verification_timeline", {"next_review_date": "Next-Weekly", "confidence_decay_rate": 0.05, "recheck_triggers": []}),
        failure_modes=raw_ai_res.get("failure_modes", [{"description": "NONE", "probability": "LOW", "early_warning_signal": ""}])
    )

    log.info("P3 completed", ticker=ticker, cat=p3_res.cat)
    return p3_res

def _stub_hermes_p3(ticker: str) -> Dict:
    """Mock Hermes 4 output for P3"""
    return {
        "cat": 2,
        "cat_confidence": 0.85,
        "cat_reasoning": "Higher lows on weekly, volume confirm",
        "trend_structure": "BULLISH",
        "support_levels": [{"price": 125.0, "strength": "STRONG", "type": "HISTORICAL"}],
        "resistance_levels": [{"price": 150.0, "strength": "MODERATE", "type": "HISTORICAL"}],
        "distortion_risk": "NONE",
        "buy_prices": {"buy1": 142.0, "buy2": 138.0, "buy3": 130.0},
        "stop_prices": {"stop1": 124.0, "stop2": 115.0},
        "weekly_trend": "UP",
        "volume_profile": "ACCUMULATION"
    }
