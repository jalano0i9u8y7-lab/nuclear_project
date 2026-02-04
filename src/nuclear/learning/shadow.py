import json
import uuid
import hashlib
import structlog
from typing import List, Optional, Literal, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel
from contextlib import closing

# Use schemas from M04-A
from nuclear.learning.schemas import LearningStateLatest
from nuclear.db.sqlite import SQLiteEngine
from nuclear.models.schemas import OrderPlan

log = structlog.get_logger()

# -------------------------------------------------------------
# 1. Pydantic Models for Shadow Enforcement
# -------------------------------------------------------------

class ShadowOrderResult(BaseModel):
    order_id: str
    ticker: str
    would_block: bool
    would_reduce_size: bool
    would_apply_bias: bool
    triggered_policies: List[str]
    severity_score: float # 0.0 to 1.0 (1.0 = full block)
    reason_summary: str

class ShadowEnforcementReport(BaseModel):
    report_id: str
    run_id: str
    learning_version: int
    enforcement_mode: Literal["shadow"] = "shadow"
    evaluated_at: str # ISO8601 UTC
    total_orders: int
    blocked_count: int
    reduced_count: int
    biased_count: int
    shadow_results: List[ShadowOrderResult]

# -------------------------------------------------------------
# 2. Policy Evaluation Logic (Pure Functions)
# -------------------------------------------------------------

def evaluate_single_order(order: OrderPlan, state: LearningStateLatest) -> ShadowOrderResult:
    """
    Evaluate one order against learning state.
    Returns ShadowOrderResult.
    Does NOT modify order.
    """
    triggered = []
    block = False
    reduce_size = False
    bias = False
    severity = 0.0
    
    # A. Check Banned Patterns
    # If order ticker matches a banned signature?
    # Spec M04-C: BannedPattern uses "signature". 
    # Current M04-A schema: BannedPattern signature is string.
    # Logic: if signature matches ticker? Or some field?
    # Simple Heuristic: If signature IS the ticker symbol or contained in it.
    for ban in state.policy_banned_patterns:
        # Check if signature matches ticker (case-insensitive)
        if ban.signature.upper() == order.ticker.upper():
            triggered.append(f"BAN:{ban.policy_id}:{ban.signature}")
            block = True
            severity = 1.0
            
    # B. Check Hard Caps
    # Logic: If rule matches ticker strings?
    if not block:
        for cap in state.policy_hard_caps:
            # Simple heuristic: if rule contains ticker
            if cap.rule and order.ticker in cap.rule: 
                triggered.append(f"CAP:{cap.policy_id}")
                block = True
                severity = 1.0
                
    # C. Check Soft Bias
    if not block:
        for sb in state.policy_soft_bias:
            if sb.rule and order.ticker in sb.rule:
                triggered.append(f"BIAS:{sb.policy_id}")
                bias = True
                severity = max(severity, 0.3)

    return ShadowOrderResult(
        order_id=str(uuid.uuid4()), # Generate temp ID for result if order doesn't have one? 
        # OrderPlan doesn't seem to have ID in its schema (based on usage in wb2.py).
        # We'll generate one or use ticker as proxy if needed.
        # Let's generate a result ID.
        ticker=order.ticker,
        would_block=block,
        would_reduce_size=reduce_size,
        would_apply_bias=bias,
        triggered_policies=triggered,
        severity_score=severity,
        reason_summary="; ".join(triggered) if triggered else "pass"
    )

def run_shadow_enforcement(
    orders: List[OrderPlan], 
    state: Optional[LearningStateLatest],
    run_id: str
) -> ShadowEnforcementReport:
    """
    Run shadow enforcement on a list of orders.
    Persists the report to DB.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    
    if not state:
        # Empty report if no state
        return ShadowEnforcementReport(
            report_id=str(uuid.uuid4()),
            run_id=run_id,
            learning_version=0,
            evaluated_at=now_iso,
            total_orders=len(orders),
            blocked_count=0, reduced_count=0, biased_count=0,
            shadow_results=[]
        )
        
    results = []
    for o in orders:
        results.append(evaluate_single_order(o, state))
        
    report = ShadowEnforcementReport(
        report_id=str(uuid.uuid4()),
        run_id=run_id,
        learning_version=state.version,
        evaluated_at=now_iso,
        total_orders=len(orders),
        blocked_count=sum(1 for r in results if r.would_block),
        reduced_count=sum(1 for r in results if r.would_reduce_size),
        biased_count=sum(1 for r in results if r.would_apply_bias),
        shadow_results=results
    )
    
    # Persist
    persist_shadow_report(report)
    
    return report

def persist_shadow_report(report: ShadowEnforcementReport):
    """Save report to SQLite."""
    payload_json = report.model_dump_json()
    payload_sha256 = hashlib.sha256(payload_json.encode('utf-8')).hexdigest()
    
    with closing(SQLiteEngine.connect()) as conn:
        with conn: # transaction
            conn.execute("""
                INSERT INTO shadow_enforcement_reports (
                    report_id, run_id, learning_version, 
                    payload_json, payload_sha256, created_at
                ) VALUES (?, ?, ?, ?, ?, ?)
            """, (
                report.report_id,
                report.run_id,
                report.learning_version,
                payload_json,
                payload_sha256,
                report.evaluated_at
            ))
    log.info("shadow_report_saved", 
             report_id=report.report_id, 
             blocked=report.blocked_count)
