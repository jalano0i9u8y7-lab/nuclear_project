
from typing import List, Dict, Optional
from pydantic import BaseModel, Field, validator
from nuclear.models.constitutional import ConstitutionalOutput

class SignalEvidence(BaseModel):
    source: str  # 例如 "P2_Output"
    tickers: List[str]
    metric: str  # 例如 "Revenue_YoY"

class P05Signal(BaseModel):
    signal_id: str  # S1, S2, ...
    signal_name: str  # 必須是以下 8 個之一
    value: float  # 0-100
    direction: str  # "UP" | "DOWN" | "STABLE"
    evidence: SignalEvidence

    @validator("signal_name")
    def validate_name(cls, v):
        valid = [
            "demand_pull_downstream", "capacity_build_upstream", 
            "inventory_pressure_midstream", "pricing_power_node",
            "order_visibility", "substitution_pressure", 
            "capex_mismatch_divergence", "credit_stress_chain"
        ]
        if v not in valid:
            raise ValueError(f"Invalid signal name: {v}")
        return v

class P05Anomaly(BaseModel):
    description: str
    severity: str

class P05Diagnosis(BaseModel):
    current_chain_state: str  # 必須是以下 7 個值之一
    state_rationale: str
    industry_ecology_profile: str
    anomalies: List[P05Anomaly]

    @validator("current_chain_state")
    def validate_state(cls, v):
        valid = [
            "ACCELERATING", "HEALTHY_EXPANSION", "LATE_TIGHTENING",
            "INVENTORY_BUILD", "DEMAND_SOFTENING", "MIXED_SIGNALS", "UNKNOWN"
        ]
        if v not in valid:
            raise ValueError(f"Invalid chain state: {v}")
        return v

class P05P1Inputs(BaseModel):
    chain_position_updates: List[dict]
    bottleneck_status: dict  # current_bottleneck, easing_signals, next_bottleneck_candidates
    new_beneficiary_candidates: List[dict]  # 含理由
    new_victim_candidates: List[dict]  # 含理由

class P05P2Inputs(BaseModel):
    revenue_trend_signals: dict
    margin_pressure_signals: dict
    capex_cycle_flags: dict  # 含 MISMATCH 標記
    inventory_cycle_position: str

class P05Handoff(BaseModel):
    p0_7_evidence_pack: dict  # demand_trend, divergence_flags
    p1_inputs: P05P1Inputs
    p2_inputs: P05P2Inputs
    p5_weekly_flags: dict  # LATE_CYCLE_RISK, INVENTORY_BUILD_WARNING

class BottleneckMigration(BaseModel):
    current_bottleneck: str
    easing_signals: List[str]
    next_bottleneck_candidates: List[str]

class AlternativeCandidate(BaseModel):
    name: str
    maturity: str  # "NEAR_READY" | "EMERGING" | "EARLY_STAGE"
    time_window: str
    region: str  # 掃描範圍不限美國

class P05Output(ConstitutionalOutput):
    """
    SSOT §4.2.3: P0.5 Supply Chain Monitor Output.
    """
    meta: dict  # version, cadence, coverage_level
    signals: List[P05Signal]  # 8 大核心訊號
    diagnosis: P05Diagnosis
    handoff: P05Handoff
    bottleneck_migration: BottleneckMigration
    alternative_candidates: List[AlternativeCandidate]
    mode: str  # "MODE_1_BASELINE" | "MODE_2_MONITOR"
    snapshot_id: str
    version_chain_id: str
    run_id: str
