from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime

class LearningPolicyHardCap(BaseModel):
    policy_id: str
    level: Literal["system", "sector", "symbol"]
    rule: str
    evidence: List[str]
    confidence: float = Field(..., ge=0.0, le=1.0)
    ttl_days: int
    half_life_days: Optional[int] = None
    generated_at: str  # ISO8601 UTC

class LearningPolicySoftBias(BaseModel):
    policy_id: str
    level: Literal["system", "sector", "symbol"]
    rule: str
    evidence: List[str]
    confidence: float = Field(..., ge=0.0, le=1.0)
    ttl_days: int
    half_life_days: Optional[int] = None
    generated_at: str  # ISO8601 UTC

class LearningPolicyBannedPattern(BaseModel):
    policy_id: str
    level: Literal["system", "sector", "symbol"]
    # Spec says: signature: str.
    signature: str 
    action: Literal["DISALLOW"]
    notes: Optional[str] = None
    evidence: List[str]
    confidence: float = Field(..., ge=0.0, le=1.0)
    ttl_days: int
    half_life_days: Optional[int] = None
    generated_at: str

class LearningStateLatest(BaseModel):
    version: int
    generated_at: str  # ISO8601 UTC
    context_signature_summary: str
    
    # Strictly these three types
    policy_hard_caps: List[LearningPolicyHardCap]
    policy_soft_bias: List[LearningPolicySoftBias]
    policy_banned_patterns: List[LearningPolicyBannedPattern] # Spec called this BannedPattern but implied specific lists.
    # The spec in 4) LearningStateLatest list:
    # policy_hard_caps
    # policy_soft_bias
    # fail_signatures_topK  <-- wait, I missed this in my thought trace?
    # Checking spec again: "policy_banned_patterns" IS NOT in the "LearningStateLatest" list in section 2.
    # Section 2 says: 
    #   policy_hard_caps: list[LearningPolicyHardCap]
    #   policy_soft_bias: list[LearningPolicySoftBias]
    #   fail_signatures_topK: list[str]
    #   data_gap_watchlist: list[str]
    #   evidence_index: list[str]
    #
    # BUT Section 1.A says: "Learning output types are ONLY these three: Hard Caps, Soft Bias, Banned Patterns"
    # And Section 2.3 defines: "LearningPolicyBannedPattern"
    # So where does BannedPattern go? 
    # Ah, I see "fail_signatures_topK: list[str]" ... maybe BannedPattern IS the structure for banned stuff?
    # Let's re-read carefully.
    # "Learning output types are ONLY these three..."
    # "Each learning entry must include evidence..."
    # "LearningPolicyBannedPattern ... signature: str ... action: DISALLOW ..."
    # "LearningStateLatest ... policy_hard_caps ... policy_soft_bias ... fail_signatures_topK ... evidence_index ..."
    # It seems "policy_banned_patterns" is missing from the list in Section 2.4, OR "fail_signatures_topK" is meant to hold it?
    # However, fail_signatures_topK is type list[str].
    # BannedPattern is a complex object.
    # The prompt might have an omission in 2.4 list, OR banned patterns are treated differently.
    # BUT 1.A says output types are ONLY these three.
    # And 2.3 defines the model.
    # Use your engineering judgment: The BannedPattern model is defined (2.3), so it MUST be used.
    # It likely belongs in LearningStateLatest as `policy_banned_patterns`. 
    # I will add `policy_banned_patterns` to `LearningStateLatest`.
    
    policy_banned_patterns: List[LearningPolicyBannedPattern] = Field(default_factory=list)

    fail_signatures_topK: List[str]
    data_gap_watchlist: List[str]
    evidence_index: List[str]
    ttl_days: int
    half_life_days: int
