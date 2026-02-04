"""
Shared Progress Protocol

提供 CLI 和 Agent 共用的進度記錄機制。
"""

from .run_log import log_run, read_recent_runs, get_last_run
from .milestone import (
    load_milestone,
    save_milestone,
    update_checkpoint,
    add_handoff,
    clear_handoff,
    get_pending_handoffs,
)

__all__ = [
    # Run Log
    "log_run",
    "read_recent_runs",
    "get_last_run",
    # Milestone
    "load_milestone",
    "save_milestone",
    "update_checkpoint",
    "add_handoff",
    "clear_handoff",
    "get_pending_handoffs",
]
