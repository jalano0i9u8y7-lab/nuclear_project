import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from nuclear.db.repos import P6Repo
from nuclear.phases.p6.backoff import retry_with_backoff

@dataclass
class P6HealthState:
    instance_id: str
    started_at: str
    last_tick_at: Optional[str] = None
    last_ok_at: Optional[str] = None
    last_error_at: Optional[str] = None
    error_count: int = 0
    last_error_summary: str = ""
    status: str = "starting"
    pid: int = 0

def init_instance(instance_id: str) -> P6HealthState:
    now = datetime.now(timezone.utc).isoformat()
    return P6HealthState(
        instance_id=instance_id,
        started_at=now,
        pid=os.getpid(),
        status="running"
    )

def mark_ok(state: P6HealthState):
    now = datetime.now(timezone.utc).isoformat()
    state.last_tick_at = now
    state.last_ok_at = now
    state.error_count = 0
    state.status = "running"

def mark_error(state: P6HealthState, exc: Exception):
    now = datetime.now(timezone.utc).isoformat()
    state.last_tick_at = now
    state.last_error_at = now
    state.error_count += 1
    state.last_error_summary = str(exc)
    
    # Status rule: degraded if recent errors and no ok within 5 min (simplified for now)
    state.status = "degraded"

def persist_state(state: P6HealthState):
    now = datetime.now(timezone.utc).isoformat()
    
    def _upsert():
        P6Repo.upsert_heartbeat(
            instance_id=state.instance_id,
            started_at=state.started_at,
            last_tick_at=state.last_tick_at or "",
            last_ok_at=state.last_ok_at or "",
            last_error_at=state.last_error_at or "",
            error_count=state.error_count,
            last_error_summary=state.last_error_summary,
            status=state.status,
            pid=state.pid,
            updated_at=now
        )
    
    retry_with_backoff(_upsert)
