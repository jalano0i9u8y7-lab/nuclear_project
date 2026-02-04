"""
Scheduled Execution Module

Provides wrapper functions for scheduled Daily and Weekly pipeline execution.
Computes Asia/Taipei date and builds CLI subprocess calls.

Usage:
    from nuclear.orchestration.schedule import run_daily, run_weekly, get_taipei_today
"""

import subprocess
import sys
import structlog
from datetime import datetime, timezone, timedelta
from typing import Optional
from zoneinfo import ZoneInfo

from nuclear.progress import log_run, update_checkpoint

log = structlog.get_logger()

# Asia/Taipei timezone
TAIPEI_TZ = ZoneInfo("Asia/Taipei")


def get_taipei_today() -> str:
    """
    Get today's date in Asia/Taipei timezone as YYYY-MM-DD string.
    
    Returns:
        Date string in YYYY-MM-DD format
    """
    now_taipei = datetime.now(TAIPEI_TZ)
    return now_taipei.strftime("%Y-%m-%d")


def get_taipei_now() -> datetime:
    """Get current datetime in Asia/Taipei timezone."""
    return datetime.now(TAIPEI_TZ)


def is_monday_taipei() -> bool:
    """Check if today is Monday in Asia/Taipei timezone."""
    return get_taipei_now().weekday() == 0


def run_daily(
    date: Optional[str] = None,
    tickers: Optional[str] = None,
    run_id: Optional[str] = None,
    dry_run: bool = False,
) -> int:
    """
    Run the Daily pipeline via subprocess.
    
    Args:
        date: Date in YYYY-MM-DD format. Defaults to Asia/Taipei today.
        tickers: Optional comma-separated ticker list
        run_id: Optional run ID. Auto-generated if not provided.
        dry_run: If True, only print command without executing.
    
    Returns:
        Exit code (0 = success)
    """
    if date is None:
        date = get_taipei_today()
    
    if run_id is None:
        run_id = f"daily_{date}_{datetime.now(timezone.utc).strftime('%H%M%S')}"
    
    cmd = [
        sys.executable, "-m", "nuclear", "daily",
        "--date", date,
        "--run-id", run_id,
    ]
    
    if tickers:
        cmd.extend(["--tickers", tickers])
    
    log.info("run_daily_start", date=date, run_id=run_id, cmd=" ".join(cmd))
    
    if dry_run:
        print(f"[DRY RUN] Would execute: {' '.join(cmd)}")
        return 0
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
        
        status = "success" if result.returncode == 0 else "failed"
        log.info("run_daily_complete", status=status, returncode=result.returncode)
        
        # Log to run_log
        log_run(
            command="daily",
            status=status,
            run_id=run_id,
            summary=f"Daily pipeline for {date}",
            errors=[result.stderr] if result.returncode != 0 else [],
        )
        
        return result.returncode
        
    except subprocess.TimeoutExpired:
        log.error("run_daily_timeout", date=date)
        log_run(
            command="daily",
            status="failed",
            run_id=run_id,
            summary=f"Daily pipeline timeout for {date}",
            errors=["Timeout after 3600 seconds"],
        )
        return 1
    except Exception as e:
        log.error("run_daily_error", error=str(e))
        log_run(
            command="daily",
            status="failed",
            run_id=run_id,
            summary=f"Daily pipeline error for {date}",
            errors=[str(e)],
        )
        return 1


def run_weekly(
    run_id: Optional[str] = None,
    dry_run: bool = False,
) -> int:
    """
    Run the Weekly pipeline (WB1 then WB2) via subprocess.
    
    Args:
        run_id: Optional run ID. Auto-generated if not provided.
        dry_run: If True, only print command without executing.
    
    Returns:
        Exit code (0 = success)
    """
    date = get_taipei_today()
    
    if run_id is None:
        run_id = f"weekly_{date}_{datetime.now(timezone.utc).strftime('%H%M%S')}"
    
    log.info("run_weekly_start", date=date, run_id=run_id)
    
    # WB1
    cmd_wb1 = [sys.executable, "-m", "nuclear", "wb1", "--run-id", run_id]
    # WB2
    cmd_wb2 = [sys.executable, "-m", "nuclear", "wb2", "--run-id", run_id]
    
    if dry_run:
        print(f"[DRY RUN] Would execute: {' '.join(cmd_wb1)}")
        print(f"[DRY RUN] Would execute: {' '.join(cmd_wb2)}")
        return 0
    
    errors = []
    
    try:
        # Run WB1
        log.info("run_wb1_start", run_id=run_id)
        result_wb1 = subprocess.run(cmd_wb1, capture_output=True, text=True, timeout=1800)
        
        if result_wb1.returncode != 0:
            log.error("run_wb1_failed", returncode=result_wb1.returncode)
            errors.append(f"WB1 failed: {result_wb1.stderr}")
            log_run(
                command="weekly",
                status="failed",
                run_id=run_id,
                summary=f"Weekly pipeline failed at WB1",
                errors=errors,
            )
            return result_wb1.returncode
        
        log.info("run_wb1_complete")
        
        # Run WB2
        log.info("run_wb2_start", run_id=run_id)
        result_wb2 = subprocess.run(cmd_wb2, capture_output=True, text=True, timeout=1800)
        
        status = "success" if result_wb2.returncode == 0 else "failed"
        if result_wb2.returncode != 0:
            errors.append(f"WB2 failed: {result_wb2.stderr}")
        
        log.info("run_weekly_complete", status=status)
        
        log_run(
            command="weekly",
            status=status,
            run_id=run_id,
            summary=f"Weekly pipeline for week of {date}",
            errors=errors if errors else [],
        )
        
        return result_wb2.returncode
        
    except subprocess.TimeoutExpired as e:
        log.error("run_weekly_timeout", step=str(e))
        log_run(
            command="weekly",
            status="failed",
            run_id=run_id,
            summary="Weekly pipeline timeout",
            errors=["Timeout"],
        )
        return 1
    except Exception as e:
        log.error("run_weekly_error", error=str(e))
        log_run(
            command="weekly",
            status="failed",
            run_id=run_id,
            summary="Weekly pipeline error",
            errors=[str(e)],
        )
        return 1


def build_daily_command(date: Optional[str] = None) -> list[str]:
    """
    Build the daily command for external use (e.g., systemd ExecStart).
    
    Args:
        date: Date in YYYY-MM-DD format. If None, uses placeholder.
    
    Returns:
        Command as list of strings
    """
    if date is None:
        date = "$(date +%Y-%m-%d)"  # Shell expansion
    return ["python", "-m", "nuclear", "daily", "--date", date]


def build_weekly_command() -> list[str]:
    """Build the weekly wrapper command."""
    return ["python", "-m", "nuclear", "schedule", "weekly"]
