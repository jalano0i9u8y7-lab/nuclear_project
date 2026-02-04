import hashlib
import json
import structlog
from typing import Dict, Any, Literal
from datetime import datetime, timezone
from pydantic import BaseModel

from nuclear.learning.state import load_learning_state_latest

log = structlog.get_logger()

class LearningGateContext(BaseModel):
    learning_version: int
    loaded_at: str  # ISO8601 UTC
    hard_caps_count: int
    soft_bias_count: int
    banned_patterns_count: int
    summary_signature: str
    enforcement_mode: Literal["off"] = "off"

def load_learning_gate() -> LearningGateContext:
    """
    Load the latest learning state and return a read-only context.
    Strictly enforcing 'enforcement_mode=off' for M05.
    """
    state = load_learning_state_latest()
    now_iso = datetime.now(timezone.utc).isoformat()
    
    if not state:
        return LearningGateContext(
            learning_version=0,
            loaded_at=now_iso,
            hard_caps_count=0,
            soft_bias_count=0,
            banned_patterns_count=0,
            summary_signature="empty_state"
        )
        
    # Calculate signature for integrity logging
    content_summary = f"v{state.version}|caps={len(state.policy_hard_caps)}|bias={len(state.policy_soft_bias)}|bans={len(state.policy_banned_patterns)}"
    signature = hashlib.sha256(content_summary.encode("utf-8")).hexdigest()[:8]
    
    context = LearningGateContext(
        learning_version=state.version,
        loaded_at=now_iso,
        hard_caps_count=len(state.policy_hard_caps),
        soft_bias_count=len(state.policy_soft_bias),
        banned_patterns_count=len(state.policy_banned_patterns),
        summary_signature=f"{content_summary}|{signature}",
        enforcement_mode="off"
    )
    
    return context
