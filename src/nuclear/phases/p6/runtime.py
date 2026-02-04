import asyncio
import structlog
import time
from datetime import datetime, timezone
from typing import Optional
from nuclear.db.sqlite import SQLiteEngine
from nuclear.phases.p6.health import init_instance, mark_ok, mark_error, persist_state

log = structlog.get_logger()

def p6_tick(run_id: Optional[str], instance_id: str, now_utc: datetime) -> dict:
    """
    Responsibilities:
    - Load latest DailySummary snapshot index (optional)
    - Log 'tick start'
    - Return summary
    """
    log.info("p6_tick_start", instance_id=instance_id, now=now_utc.isoformat())
    
    # Mocking check for DailySummary
    with SQLiteEngine.connect() as conn:
        row = conn.execute(
            "SELECT * FROM snapshots_index WHERE phase = 'daily/daily_summary' ORDER BY created_at DESC LIMIT 1"
        ).fetchone()
        
    if not row:
        return {"action": "skip", "reason": "no_daily_summary"}
    
    return {
        "action": "ok", 
        "daily_date": row["created_at"], 
        "notes": "stub"
    }

async def run_p6_daemon(interval_sec: int = 30, instance_id: Optional[str] = None, stop_event: Optional[asyncio.Event] = None):
    instance_id = instance_id or "p6_local"
    state = init_instance(instance_id)
    
    log.info("P6 daemon loop starting", instance_id=instance_id, interval=interval_sec)
    
    try:
        while True:
            if stop_event and stop_event.is_set():
                break
                
            now = datetime.now(timezone.utc)
            try:
                result = p6_tick(run_id=None, instance_id=instance_id, now_utc=now)
                mark_ok(state)
                log.info("p6_tick_result", result=result)
            except Exception as e:
                log.error("p6_tick_failed", error=str(e))
                mark_error(state, e)
            
            persist_state(state)
            
            # Sleep for interval_sec, checking for stop_event
            for _ in range(interval_sec):
                if stop_event and stop_event.is_set():
                    break
                await asyncio.sleep(1)
                
    except KeyboardInterrupt:
        log.info("P6 daemon interrupt received")
    finally:
        state.status = "stopped"
        persist_state(state)
        log.info("P6 daemon loop exited")
