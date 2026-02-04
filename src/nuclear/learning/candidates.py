from typing import List, Literal, Optional
from pydantic import BaseModel, Field

class BaseCandidate(BaseModel):
    candidate_id: str
    category: Literal["hard_cap", "soft_bias", "banned_pattern"]
    level: Literal["system", "sector", "symbol"]
    proposal: str
    evidence: List[str]
    confidence: float = Field(..., ge=0.0, le=1.0)
    suggested_ttl_days: int
    generated_at: str  # ISO8601 UTC
    source: str

# Subclasses for cleaner typing in observers
class CandidateHardCap(BaseCandidate):
    category: Literal["hard_cap"] = "hard_cap"

class CandidateSoftBias(BaseCandidate):
    category: Literal["soft_bias"] = "soft_bias"

class CandidateBannedPattern(BaseCandidate):
    category: Literal["banned_pattern"] = "banned_pattern"
