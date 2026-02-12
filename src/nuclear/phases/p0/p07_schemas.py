
from typing import List, Dict, Optional
from pydantic import BaseModel, Field, validator
from nuclear.models.constitutional import ConstitutionalOutput

class LeveragedRole(BaseModel):
    role_type: str  # 例如「平台核心層」「合規入口層」
    reasoning: str

class CausalLoop(BaseModel):
    loop_type: str  # "R" | "B"
    description: str
    causal_chain: List[str]  # 因果鏈步驟

class NarrativeAlignment(BaseModel):
    alignment_status: str  # "NARRATIVE_EXCEEDS_STRUCTURE" | "STRUCTURE_EXCEEDS_NARRATIVE" | "TIME_MISMATCH" | "ALIGNED"
    misalignment_risk: str  # 錯位會造成的投資誤判

class P07SystemOverrides(BaseModel):
    u_max_override: Optional[float] = None # 若 LATE 或 TURNING_POINT_RISK=HIGH
    u_max_conditions: Optional[str] = None # 觸發條件描述

class P07Output(ConstitutionalOutput):
    """
    SSOT §4.3.4: P0.7 System Dynamics Output.
    """
    dynamic_problem_one_liner: str
    loop_dominance: str  # "REINFORCING" | "BALANCING" | "MIXED" | "TRANSITIONAL"
    time_position: str  # "EARLY" | "MID" | "LATE" | "TRANSITION"
    turning_point_risk: str  # "HIGH" | "MED" | "LOW"
    leveraged_role_type: LeveragedRole
    risk_note: str  # 若跳過 P0.7 最可能犯的錯
    
    reinforcing_loop: CausalLoop
    balancing_loop: CausalLoop
    
    narrative_structure_alignment: NarrativeAlignment
    system_overrides: P07SystemOverrides
    
    snapshot_id: str
    version_chain_id: str
    run_id: str

    @validator("loop_dominance")
    def validate_dominance(cls, v):
        valid = ["REINFORCING", "BALANCING", "MIXED", "TRANSITIONAL"]
        if v not in valid:
            raise ValueError(f"Invalid loop dominance: {v}")
        return v

    @validator("time_position")
    def validate_position(cls, v):
        valid = ["EARLY", "MID", "LATE", "TRANSITION"]
        if v not in valid:
            raise ValueError(f"Invalid time position: {v}")
        return v

    @validator("turning_point_risk")
    def validate_risk(cls, v):
        valid = ["HIGH", "MED", "LOW"]
        if v not in valid:
            raise ValueError(f"Invalid turning point risk: {v}")
        return v
