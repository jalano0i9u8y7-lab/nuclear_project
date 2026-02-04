from typing import List, Dict, Any
import uuid
from datetime import datetime, timezone
from nuclear.learning.candidates import CandidateBannedPattern

def observe_churn(context: Dict[str, Any]) -> List[CandidateBannedPattern]:
    """
    Observer: Detects frequent reversals (churn).
    """
    candidates = []
    
    history = context.get("history_samples", [])
    if not history:
        return []
    
    # Stub logic: if "reversals_7d" > 3
    for sample in history:
        if sample.get("reversals_7d", 0) > 3:
            cand = CandidateBannedPattern(
                candidate_id=str(uuid.uuid4()),
                level="symbol",
                proposal=f"Ban symbol {sample.get('symbol')} due to churn",
                evidence=[f"Reversals count {sample.get('reversals_7d')} > 3"],
                confidence=0.6,
                suggested_ttl_days=7,
                generated_at=datetime.now(timezone.utc).isoformat(),
                source="churn_observer"
            )
            candidates.append(cand)
            
    return candidates
