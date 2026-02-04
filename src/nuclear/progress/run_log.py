"""
Shared Progress Protocol - Run Log Module

CLI 執行完成後自動記錄到 run_log.jsonl，供 Agent 讀取以了解自動化任務進度。
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

RUN_LOG_PATH = Path("logs/run_log.jsonl")


def log_run(
    command: str,
    status: str,  # "success" | "failed" | "partial"
    run_id: str,
    summary: str,
    artifacts: Optional[list[str]] = None,
    errors: Optional[list[str]] = None,
    metrics: Optional[dict] = None,
) -> dict:
    """
    CLI 執行後自動呼叫，append 一條 JSON 到 run_log.jsonl
    
    Args:
        command: CLI 命令名稱 (wb1, wb2, p6, daily, etc.)
        status: 執行狀態
        run_id: 執行 ID
        summary: 簡短摘要
        artifacts: 產出的檔案路徑列表
        errors: 錯誤訊息列表
        metrics: 額外指標 (duration_sec, record_count, etc.)
    
    Returns:
        寫入的 entry dict
    """
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "command": command,
        "status": status,
        "run_id": run_id,
        "summary": summary,
        "artifacts": artifacts or [],
        "errors": errors or [],
        "metrics": metrics or {},
    }
    
    RUN_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(RUN_LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    
    return entry


def read_recent_runs(n: int = 20) -> list[dict]:
    """
    讀取最近 n 條執行記錄，供 Agent 了解 CLI 進度
    """
    if not RUN_LOG_PATH.exists():
        return []
    
    lines = RUN_LOG_PATH.read_text(encoding="utf-8").strip().split("\n")
    recent = lines[-n:] if len(lines) > n else lines
    
    return [json.loads(line) for line in recent if line.strip()]


def get_last_run(command: Optional[str] = None) -> Optional[dict]:
    """
    取得最後一次執行記錄，可選擇篩選特定命令
    """
    runs = read_recent_runs(50)
    if command:
        runs = [r for r in runs if r.get("command") == command]
    return runs[-1] if runs else None
