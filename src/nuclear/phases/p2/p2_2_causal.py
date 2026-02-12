
from typing import Dict, Any, List
import structlog
from datetime import datetime, timezone
from nuclear.phases.p2.p2_schemas import Phase2Output, P21FactModel, GrowthSubScores, OperatingLeverageInflection
from nuclear.phases.p2.p2_2_prompts import build_p22_analyst_prompt

log = structlog.get_logger()

def run_p2_2(
    ticker: str, 
    p21_model: P21FactModel, 
    p0_logic_card: Dict[str, Any], 
    p05_handoff: Dict[str, Any], 
    p1_company: Dict[str, Any], 
    p1_extraction: Dict[str, Any], 
    p07_output: Dict[str, Any],
    run_id: str = "default", 
    version_chain_id: str = "default"
) -> Phase2Output:
    """
    SSOT §6.3: P2-2 Causal 推論層 Main Logic.
    Transition from facts to reasoning and future paths.
    """
    log.info("Starting P2-2 Causal Defense", ticker=ticker)

    # 1. Prompt Construction (Task 3.3 - Prompts)
    prompt = build_p22_analyst_prompt(
        ticker, 
        p21_model.model_dump(), 
        p0_logic_card, 
        p05_handoff, 
        p1_extraction
    )

    # 2. LLM Execution (Stub)
    raw_ai_res = _stub_hermes_p2_2(ticker)
    
    # 3. SSOT Rule: Future Breakout Grade Cap (§6.8.3)
    time_pos = p07_output.get("time_position", "MID")
    risk = p07_output.get("turning_point_risk", "LOW")
    grade = raw_ai_res["future_breakout_grade"]
    
    if time_pos == "LATE" and risk == "HIGH":
        if grade in ["S", "A"]: grade = "B"
    elif time_pos == "LATE" or risk == "HIGH":
        if grade == "S": grade = "A"
    
    # 4. SSOT Rule: Frontier Security Lock (§6.8.3)
    fp_score = raw_ai_res["future_potential_score"]
    if p1_company.get("track_type") == "FRONTIER":
        runway = p21_model.fact_items.get("runway_quarters", 0) # Fallback to fact model
        if runway < 4 and fp_score > 70:
            fp_score = 70.0

    # 5. SSOT Rule: Narrative Heavy Flag (§6.8.3)
    inev = raw_ai_res["inevitability_score"]
    exec_sc = raw_ai_res["executability_score"]
    if inev >= 80 and exec_sc <= 40:
        log.info("Flagging as NARRATIVE_HEAVY", ticker=ticker)
        # In a real system, would add a metadata flag

    # 6. Assembly
    p2_out = Phase2Output(
        ticker=ticker,
        risk_profile=p21_model.risk_profile,
        risk_note=p21_model.risk_note,
        growth_grade=raw_ai_res["growth_grade"],
        growth_sub_scores=GrowthSubScores(**raw_ai_res["growth_sub_scores"]),
        growth_grade_reasoning=raw_ai_res["growth_grade_reasoning"],
        growth_low_quality_flag=p21_model.growth_low_quality_flag,
        operating_leverage_inflection=p21_model.operating_leverage_inflection,
        future_potential_score=fp_score,
        future_breakout_grade=grade,
        inevitability_score=inev,
        executability_score=exec_sc,
        fpe_a=p21_model.fpe_a,
        fpe_b=p21_model.fpe_b,
        fpe_divergence=p21_model.fpe_divergence,
        fpe_b_vs_peers_percentile=raw_ai_res.get("fpe_b_vs_peers_percentile"),
        track_type=p1_company.get("track_type", "CORE"),
        position_role=raw_ai_res["position_role"],
        mispricing_type=raw_ai_res["mispricing_type"],
        thesis_statement=raw_ai_res["thesis_statement"],
        thesis_validation_triggers=raw_ai_res["thesis_validation_triggers"],
        milestones=raw_ai_res["milestones"],
        narrative_tree_summary=raw_ai_res["narrative_tree_summary"],
        three_scenario_summary=raw_ai_res["three_scenario_summary"],
        peer_group=p21_model.peer_group,
        p0_conviction_level=p1_company.get("p0_conviction_level", "MEDIUM"),
        tier=p1_company.get("tier", "B"),
        primary_sector=p1_company.get("primary_sector", "Unknown"),
        secondary_sector=p1_company.get("secondary_sector"),
        rerate_state=p1_company.get("rerate_state", "R1"),
        snapshot_id=f"snap_p22_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
        version_chain_id=version_chain_id,
        as_of_date=datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        run_id=run_id,
        created_at=datetime.now(timezone.utc).isoformat(),
        # Article 1 Compliance
        future_projection=raw_ai_res["future_projection"],
        falsification_checkpoints=raw_ai_res["falsification_checkpoints"],
        verification_timeline=raw_ai_res["verification_timeline"],
        failure_modes=raw_ai_res["failure_modes"]
    )

    log.info("P2-2 Causal Defense completed", ticker=ticker, grade=p2_out.growth_grade)
    return p2_out

def _stub_hermes_p2_2(ticker: str) -> Dict:
    """Mock causal deduction."""
    return {
        "growth_grade": "S",
        "growth_sub_scores": {"growth_rate_score": 85, "growth_consistency_score": 75, "operating_leverage_score": 70, "cash_conversion_score": 65},
        "growth_grade_reasoning": "Dominant software-like margins in hardware.",
        "future_potential_score": 90.0,
        "future_breakout_grade": "S",
        "inevitability_score": 85.0,
        "executability_score": 80.0,
        "position_role": "A_MOMENTUM_COMPOUNDER",
        "mispricing_type": ["structural_repricing"],
        "thesis_statement": "NVDA is the foundational toll bridge for the AI era.",
        "thesis_validation_triggers": {"bull_case_confirmed": ["T1"], "thesis_broken": ["B1"]},
        "milestones": [{"target": "M1", "verification_source": "10-Q", "verification_method": "Check Revenue", "expected_date": "2026-05"}],
        "narrative_tree_summary": "Core Narrative: AI compute scarcity.",
        "three_scenario_summary": {
            "base": {"trigger": "T", "leading_indicators": ["L"], "expected_financial_signatures": "F", "falsification_checkpoints": ["C"], "failure_mode": "M"},
            "bull": {"trigger": "T", "leading_indicators": ["L"], "expected_financial_signatures": "F", "falsification_checkpoints": ["C"], "failure_mode": "M"},
            "bear": {"trigger": "T", "leading_indicators": ["L"], "expected_financial_signatures": "F", "falsification_checkpoints": ["C"], "failure_mode": "M"}
        },
        "future_projection": {"direction": "UP", "time_window": "12 months", "confidence": 0.9, "key_drivers": ["AI"]},
        "falsification_checkpoints": [{"signal": "S1", "condition": "C1", "timeline": "T1"}],
        "verification_timeline": {"next_review_date": "2026-06-01", "confidence_decay_rate": 0.05},
        "failure_modes": [{"description": "F1", "probability": "LOW"}]
    }
