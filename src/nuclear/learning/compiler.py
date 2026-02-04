import json
import uuid
import structlog
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from contextlib import closing

from nuclear.db.sqlite import SQLiteEngine
from nuclear.learning.schemas import (
    LearningStateLatest, LearningPolicyHardCap, 
    LearningPolicySoftBias, LearningPolicyBannedPattern
)
from nuclear.learning.candidates import BaseCandidate
from nuclear.learning.state import (
    save_learning_state, load_learning_state_latest
)

log = structlog.get_logger()

# CONFIG Defaults
DEFAULT_LOOKBACK_DAYS = 7
DEFAULT_TOP_K_CAPS = 20
DEFAULT_TOP_K_BIAS = 20
DEFAULT_TOP_K_BANS = 50

def load_recent_candidates(days: int = DEFAULT_LOOKBACK_DAYS) -> List[Dict[str, Any]]:
    """
    Load candidates from log within lookback window.
    Returns list of dicts (parsed JSON payloads).
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    candidates = []
    
    with closing(SQLiteEngine.connect()) as conn:
        conn.row_factory = None # Get raw tuples, manually parse
        # We select raw payload to ensure full fidelity
        rows = conn.execute(
            "SELECT payload_json FROM learning_candidates_log WHERE created_at >= ? ORDER BY created_at DESC", 
            (cutoff,)
        ).fetchall()
        
        for r in rows:
            try:
                candidates.append(json.loads(r[0]))
            except Exception as e:
                log.error("json_parse_failed", error=str(e))
                continue
                
    return candidates

def compile_learning_state(
    lookback_days: int = DEFAULT_LOOKBACK_DAYS,
    force_new_version: bool = False
) -> Optional[LearningStateLatest]:
    """
    Compiles candidates into a new LearningStateLatest.
    
    Idempotency Rule: 
    - Function returns the NEW state object IF it differs from current state.
    - If content is identical to current state (ignoring version/timestamp), returns None (no write needed).
    - Unless force_new_version=True.
    
    Returns: The new LearningStateLatest object that WAS saved, or None if skipped.
    """
    
    # 1. Load context
    current_state = load_learning_state_latest()
    candidates_data = load_recent_candidates(lookback_days)
    
    # 2. Compile Policies (Deterministic)
    # Strategy: Group by (category, level, proposal). Keep highest confidence.
    
    grouped: Dict[str, Dict[str, Any]] = {} 
    
    for c in candidates_data:
        # Key for de-duplication: category + level + proposal
        # "proposal" might be long text, maybe we should slugify? 
        # Spec says: "De-duplicate by (category, level, proposal signature)"
        # Using proposal string directly as signature for now.
        key = f"{c['category']}|{c['level']}|{c['proposal']}"
        
        if key not in grouped:
            grouped[key] = c
        else:
            # Keep higher confidence
            if c.get("confidence", 0) > grouped[key].get("confidence", 0):
                grouped[key] = c
                
    # 3. Sort and Top-K filter per category
    # Categories: hard_cap, soft_bias, banned_pattern
    all_unique = list(grouped.values())
    
    # Helper to process category
    def process_category(cat_name, top_k, ModelClass):
        items = [x for x in all_unique if x['category'] == cat_name]
        # Sort desc by confidence
        items.sort(key=lambda x: x.get("confidence", 0), reverse=True)
        items = items[:top_k]
        
        policies = []
        for x in items:
            # Map Candidate -> Policy
            # Generate deterministic ID? Or random? 
            # Policy ID should arguably vary if content varies. 
            # But here we generate fresh snapshot. UUID4 is fine.
            # Wait, if we use UUID4, content ALWAYS differs!
            # To support Idempotency, we must NOT use random UUIDs if we want binary compare to work?
            # OR we exclude UUIDs from comparison.
            # Strategy: Compare CONTENT (rules, evidence) only. 
            
            # Construct Model
            # Map fields:
            # Candidate: evidence, confidence, suggested_ttl_days -> ttl_days
            # Policy HardCap uses 'rule' field. Candidate uses 'proposal'.
            # M04-B implementation mapped proposal. 
            # M04-A schema: rule: str.
            # Mapping: rule = proposal.
            
            policies.append(ModelClass(
                policy_id=str(uuid.uuid4()), # Will cause content diff unless handled
                level=x['level'],
                rule=x['proposal'] if cat_name != "banned_pattern" else "N/A", # Banned uses signature/proposal
                # Wait, BannedPattern schema uses 'signature', not 'rule'.
                signature=x['proposal'] if cat_name == "banned_pattern" else "N/A",
                action="DISALLOW" if cat_name == "banned_pattern" else None,
                evidence=x.get('evidence', []),
                confidence=x.get('confidence', 0),
                ttl_days=x.get('suggested_ttl_days', 30),
                half_life_days=None,
                generated_at=datetime.now(timezone.utc).isoformat(),
                notes=None
            ))
        return policies

    # Build Lists
    # Hard Caps
    # M04-A Schema: HardCap rule, evidence...
    hard_caps = []
    hard_cap_cands = [x for x in all_unique if x['category'] == 'hard_cap']
    hard_cap_cands.sort(key=lambda x: x.get("confidence", 0), reverse=True)
    for x in hard_cap_cands[:DEFAULT_TOP_K_CAPS]:
        hard_caps.append(LearningPolicyHardCap(
            policy_id=str(uuid.uuid4()),
            level=x['level'],
            rule=x['proposal'],
            evidence=x.get('evidence', []),
            confidence=x.get('confidence', 0),
            ttl_days=x.get('suggested_ttl_days', 30),
            half_life_days=None,
            generated_at=datetime.now(timezone.utc).isoformat()
        ))
        
    # Soft Bias
    soft_bias = []
    bias_cands = [x for x in all_unique if x['category'] == 'soft_bias']
    bias_cands.sort(key=lambda x: x.get("confidence", 0), reverse=True)
    for x in bias_cands[:DEFAULT_TOP_K_BIAS]:
        soft_bias.append(LearningPolicySoftBias(
            policy_id=str(uuid.uuid4()),
            level=x['level'],
            rule=x['proposal'],
            evidence=x.get('evidence', []),
            confidence=x.get('confidence', 0),
            ttl_days=x.get('suggested_ttl_days', 30),
            half_life_days=None,
            generated_at=datetime.now(timezone.utc).isoformat()
        ))
        
    # Banned Patterns
    banned = []
    ban_cands = [x for x in all_unique if x['category'] == 'banned_pattern']
    ban_cands.sort(key=lambda x: x.get("confidence", 0), reverse=True)
    for x in ban_cands[:DEFAULT_TOP_K_BANS]:
        banned.append(LearningPolicyBannedPattern(
            policy_id=str(uuid.uuid4()),
            level=x['level'],
            signature=x['proposal'], # Mapping proposal to signature
            action="DISALLOW",
            evidence=x.get('evidence', []),
            confidence=x.get('confidence', 0),
            ttl_days=x.get('suggested_ttl_days', 30),
            half_life_days=None,
            generated_at=datetime.now(timezone.utc).isoformat()
        ))
        
    # 4. Construct Proposed State
    # Version logic: current + 1, or 1
    next_ver = (current_state.version + 1) if current_state else 1
    
    # Extra fields
    # fail_signatures_topK -> from banned list signatures
    fail_sigs = [b.signature for b in banned]
    
    # evidence_index -> collect all
    all_evidence = set()
    for p in hard_caps + soft_bias + banned:
        for e in p.evidence:
            all_evidence.add(e)
            
    proposed_state = LearningStateLatest(
        version=next_ver,
        generated_at=datetime.now(timezone.utc).isoformat(),
        context_signature_summary=f"compiled_candidates: {len(candidates_data)} items; window={lookback_days}d",
        policy_hard_caps=hard_caps,
        policy_soft_bias=soft_bias,
        policy_banned_patterns=banned,
        fail_signatures_topK=fail_sigs,
        data_gap_watchlist=[], # Stub
        evidence_index=list(all_evidence),
        ttl_days=30, # Default for the package?
        half_life_days=30
    )
    
    # 5. Idempotency Check
    if current_state and not force_new_version:
        # Compare "Content"
        # We exclude: version, generated_at, policy_ids, and timestamps in items?
        # Actually, generated_at in items is "now". 
        # So every run produces a "different" state because of timestamps/IDs.
        # To truly support idempotency, we need to generate IDs deterministically or exclude them.
        # Or, we accept that "if the set of rules is semantically identical", we skip.
        
        # Helper to extract signature of state
        def extract_semantic_signature(state: LearningStateLatest):
            # Sort items by rule/signature to ensure order invariant comparison
            # Extract list of tuples (level, rule/signature, evidence_hash?)
            
            def sig_item(item):
                if hasattr(item, 'rule'): return (item.level, item.rule)
                if hasattr(item, 'signature'): return (item.level, item.signature)
                return ()
                
            caps = sorted([sig_item(x) for x in state.policy_hard_caps])
            biases = sorted([sig_item(x) for x in state.policy_soft_bias])
            bans = sorted([sig_item(x) for x in state.policy_banned_patterns])
            
            return (caps, biases, bans)
            
        prev_sig = extract_semantic_signature(current_state)
        new_sig = extract_semantic_signature(proposed_state)
        
        if prev_sig == new_sig:
            log.info("compiler_idempotent_skip", version=current_state.version)
            return None

    # 6. Save
    save_learning_state(proposed_state)
    log.info("compiler_state_saved", version=proposed_state.version, items=len(candidates_data))
    return proposed_state

def run_compiler():
    """Entry point for easier execution."""
    return compile_learning_state()
