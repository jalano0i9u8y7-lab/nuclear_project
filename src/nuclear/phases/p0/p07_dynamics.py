
import json
from datetime import datetime, timezone
from typing import List, Dict, Optional
import structlog

from nuclear.phases.p0.p07_schemas import P07Output, P07SystemOverrides, LeveragedRole, CausalLoop, NarrativeAlignment
from nuclear.phases.p0.p07_prompts import build_p07_prompt
from nuclear.phases.p0.p0_schemas import P0Output
from nuclear.phases.p0.p05_schemas import P05Output

log = structlog.get_logger()

def compute_p07_overrides(time_position: str, turning_point_risk: str, market_regime: str) -> P07SystemOverrides:
    """
    SSOT §4.3.5: System-level Override Iron Rules (Pure Math, No AI).
    
    Conditions                                U_max Limit
    LATE + Market Regime = BULL             60%
    LATE + Market Regime = BEAR             40%
    TURNING_POINT_RISK = HIGH (Any Regime)  50%
    """
    u_max = None
    conditions = None
    
    if time_position == "LATE" and market_regime == "BULL":
        u_max = 0.60
        conditions = "P0.7 LATE + BULL → U_max 60%"
    elif time_position == "LATE" and market_regime == "BEAR":
        u_max = 0.40
        conditions = "P0.7 LATE + BEAR → U_max 40%"
    
    if turning_point_risk == "HIGH":
        tp_max = 0.50
        if u_max is None or tp_max < u_max:
             u_max = tp_max
             conditions = "P0.7 TURNING_POINT_RISK HIGH → U_max 50%"
    
    return P07SystemOverrides(u_max_override=u_max, u_max_conditions=conditions)

def compute_loop_dominance_effects(loop_dominance: str) -> dict:
    """
    SSOT §4.3.5: Loop_Dominance Downstream Effects.
    """
    effects = {}
    if loop_dominance == "REINFORCING":
        effects["offensive_mode_threshold_reduction"] = True
    elif loop_dominance == "BALANCING":
        effects["risk_overlay_level_increase"] = True
    elif loop_dominance == "TRANSITIONAL":
        effects["cycle_transition_risk_flag"] = True
    return effects

def run_p07(
    p0_output: P0Output, 
    p05_output: P05Output, 
    market_regime: str = "BULL",
    run_id: str = "default",
    version_chain_id: str = "default"
) -> P07Output:
    """
    SSOT §4.3: P0.7 System Dynamics Main Pipeline.
    """
    log.info("Starting P0.7 run", run_id=run_id)

    # 1. Prompt Construction
    prompt = build_p07_prompt(
        p0_output.model_dump(), 
        p05_output.handoff.p0_7_evidence_pack
    )
    
    # 2. LLM Execution (Stubbed for Epoch 1)
    # Using o3 as per SSOT §2.7
    raw_output = _stub_o3_dynamics()
    
    # 3. System Overrides (Deterministic Python Logic)
    overrides = compute_p07_overrides(
        raw_output["time_position"], 
        raw_output["turning_point_risk"],
        market_regime
    )
    
    # 4. Loop Dominance Effects
    effects = compute_loop_dominance_effects(raw_output["loop_dominance"])
    
    # 5. Parsing and Schema Validation
    p07_out = P07Output(
        dynamic_problem_one_liner=raw_output["dynamic_problem_one_liner"],
        loop_dominance=raw_output["loop_dominance"],
        time_position=raw_output["time_position"],
        turning_point_risk=raw_output["turning_point_risk"],
        leveraged_role_type=LeveragedRole(**raw_output["leveraged_role_type"]),
        risk_note=raw_output["risk_note"],
        reinforcing_loop=CausalLoop(**raw_output["reinforcing_loop"]),
        balancing_loop=CausalLoop(**raw_output["balancing_loop"]),
        narrative_structure_alignment=NarrativeAlignment(**raw_output["narrative_structure_alignment"]),
        system_overrides=overrides,
        snapshot_id=f"snap_p07_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}",
        version_chain_id=version_chain_id,
        run_id=run_id,
        # Constitutional Fields (Mocked)
        future_projection=raw_output["future_projection"],
        falsification_checkpoints=raw_output["falsification_checkpoints"],
        verification_timeline=raw_output["verification_timeline"],
        failure_modes=raw_output["failure_modes"]
    )
    
    log.info("P0.7 run completed", snapshot_id=p07_out.snapshot_id, u_max_override=overrides.u_max_override)
    return p07_out

def _stub_o3_dynamics() -> Dict:
    """Mock output for System Dynamics."""
    return {
        "dynamic_problem_one_liner": "Can the positive feedback of AI infrastructure build-out survive the eventual yield convergence?",
        "loop_dominance": "REINFORCING",
        "time_position": "LATE",
        "turning_point_risk": "LOW",
        "leveraged_role_type": {
            "role_type": "Platform Core Layer",
            "reasoning": "Controls the standard for all downstream application development."
        },
        "risk_note": "Skipping P0.7 may lead to missing the transition from momentum to structural stabilization.",
        "reinforcing_loop": {
            "loop_type": "R",
            "description": "Foundry expansion -> Lower unit cost -> Higher adoption -> More expansion",
            "causal_chain": ["CAPEX", "YIELD", "DEMAND", "PROFIT"]
        },
        "balancing_loop": {
            "loop_type": "B",
            "description": "Oversupply -> Price crash -> Capex halt",
            "causal_chain": ["CAPACITY", "PRICE", "MARGIN", "INVESTMENT"]
        },
        "narrative_structure_alignment": {
            "alignment_status": "ALIGNED",
            "misalignment_risk": "Currently minimal as narrative matches engineering roadmap."
        },
        "future_projection": {
            "direction": "UP",
            "time_window": "18 months",
            "confidence": 0.8,
            "key_drivers": ["Ecosystem Lock-in"]
        },
        "falsification_checkpoints": [
            {"signal": "Order Cancellation", "condition": "Rate > 10%", "timeline": "6 months", "severity": "HIGH"}
        ],
        "verification_timeline": {
            "next_review_date": "2026-07-01",
            "confidence_decay_rate": 0.04
        },
        "failure_modes": [
            {"description": "Sudden regulatory shift", "probability": "LOW"}
        ]
    }
