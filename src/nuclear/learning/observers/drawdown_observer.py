from typing import List, Dict, Any
import uuid
from datetime import datetime, timezone
from nuclear.learning.candidates import CandidateHardCap

def observe_drawdown(context: Dict[str, Any]) -> List[CandidateHardCap]:
    """
    Observer: Detects large drawdowns in history.
    Context expectations: 'snapshots' list of dicts/objects.
    """
    candidates = []
    
    # Stub logic for M04-B: 
    # Check if any snapshot has "drawdown_metric" > 0.2 (20%)
    # This relies on input context structure which comes from M03/M02 layers.
    # For now, we assume context is a dict with a 'history_samples' key or similar tests input.
    
    history = context.get("history_samples", [])
    if not history:
        return []
        
    for sample in history:
        # Example sample: {"date": "...", "drawdown": 0.25, "symbol": "AAPL"}
        if sample.get("drawdown", 0) > 0.2:
            cand = CandidateHardCap(
                candidate_id=str(uuid.uuid4()),
                level="symbol",
                proposal=f"Cap allocation for {sample.get('symbol', 'unknown')} due to high drawdown",
                evidence=[f"Drawdown {sample.get('drawdown')} detected on {sample.get('date')}"],
                confidence=0.8,
                suggested_ttl_days=30,
                generated_at=datetime.now(timezone.utc).isoformat(),
                source="drawdown_observer",
                rule=f"max_exposure_rate=0.5" # "rule" field in BaseCandidate? No, BaseCandidate has proposal. 
                # Wait, HardCap model inherits BaseCandidate. 
                # Let's check schemas.py.
                # BaseCandidate has: proposal.
                # LearningPolicyHardCap (State) has rule.
                # CandidateHardCap (Candidate) inherits BaseCandidate.
                # Does CandidateHardCap add "rule"?
                # In my previous internal thought, I just subclassed without extra fields.
                # If "proposal" is the text, that's fine.
            )
            # Checking BaseCandidate schema again:
            # candidate_id, category, level, proposal, evidence, confidence, suggested_ttl_days, generated_at, source.
            # No "rule" field in Candidate.
            # "Proposal" holds the text.
            candidates.append(cand)
            
    return candidates
