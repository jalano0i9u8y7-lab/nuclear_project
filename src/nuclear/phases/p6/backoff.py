import time
import random
import sqlite3
import structlog
from typing import Callable, Any

log = structlog.get_logger()

def is_transient_db_error(exc: Exception) -> bool:
    """Detect sqlite 'database is locked' / 'PermissionError' / 'OperationalError' common strings."""
    msg = str(exc).lower()
    if isinstance(exc, sqlite3.OperationalError):
        if "database is locked" in msg or "busy" in msg:
            return True
    if isinstance(exc, PermissionError):
        return True
    if "database is locked" in msg:
        return True
    return False

def retry_with_backoff(
    fn: Callable[[], Any], 
    max_attempts: int = 8, 
    base_delay_ms: int = 100, 
    max_delay_ms: int = 4000
) -> Any:
    """Exponential backoff + jitter for transient errors."""
    last_exc = None
    for attempt in range(max_attempts):
        try:
            return fn()
        except Exception as e:
            last_exc = e
            if not is_transient_db_error(e):
                raise e
            
            if attempt == max_attempts - 1:
                log.error("retry_exhausted", error=str(e), attempts=max_attempts)
                raise e
            
            delay = min(max_delay_ms, base_delay_ms * (2 ** attempt))
            jitter = random.uniform(0.8, 1.2)
            wait_time = (delay * jitter) / 1000.0
            
            log.warn("transient_error_retry", error=str(e), attempt=attempt + 1, wait_sec=wait_time)
            time.sleep(wait_time)
            
    if last_exc:
        raise last_exc
