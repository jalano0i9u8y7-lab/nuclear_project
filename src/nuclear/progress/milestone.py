"""
Shared Progress Protocol - Milestone Module

CLI 和 Agent 共用的里程碑記錄，雙方都可讀寫。
"""

import yaml
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Literal

MILESTONE_PATH = Path("docs/milestone.yaml")

ActorType = Literal["cli", "agent"]
StatusType = Literal["pending", "in_progress", "completed", "blocked"]


def load_milestone() -> dict:
    """載入 milestone.yaml，若不存在則建立初始結構"""
    if not MILESTONE_PATH.exists():
        initial = {
            "version": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ"),
            "current_phase": "M00",
            "last_updated_by": "system:init",
            "checkpoints": [],
            "pending_handoff": [],
        }
        save_milestone(initial)
        return initial
    
    with open(MILESTONE_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def save_milestone(data: dict) -> None:
    """儲存 milestone.yaml"""
    data["version"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    MILESTONE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MILESTONE_PATH, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, sort_keys=False, default_flow_style=False)


def update_checkpoint(
    checkpoint_id: str,
    status: StatusType,
    updated_by: ActorType,
    notes: Optional[str] = None,
    artifacts: Optional[list[str]] = None,
) -> dict:
    """
    更新或建立檢查點
    
    Args:
        checkpoint_id: 檢查點 ID (例如 M08, SKILLS_V1)
        status: 狀態
        updated_by: 更新者 (cli 或 agent)
        notes: 備註
        artifacts: 相關產出
    """
    data = load_milestone()
    now = datetime.now(timezone.utc).isoformat()
    
    # 尋找現有 checkpoint
    existing = None
    for cp in data.get("checkpoints", []):
        if cp.get("id") == checkpoint_id:
            existing = cp
            break
    
    if existing:
        existing["status"] = status
        existing["last_updated_at"] = now
        existing["last_updated_by"] = updated_by
        if notes:
            existing["notes"] = notes
        if artifacts:
            existing["artifacts"] = artifacts
        if status == "completed" and "completed_at" not in existing:
            existing["completed_at"] = now
            existing["completed_by"] = updated_by
    else:
        new_cp = {
            "id": checkpoint_id,
            "status": status,
            "started_at": now,
            "started_by": updated_by,
        }
        if notes:
            new_cp["notes"] = notes
        if artifacts:
            new_cp["artifacts"] = artifacts
        if status == "completed":
            new_cp["completed_at"] = now
            new_cp["completed_by"] = updated_by
        data.setdefault("checkpoints", []).append(new_cp)
    
    data["last_updated_by"] = f"{updated_by}:{checkpoint_id}"
    save_milestone(data)
    return data


def add_handoff(
    from_actor: ActorType,
    to_actor: ActorType,
    task: str,
    blocking: bool = False,
    context: Optional[dict] = None,
) -> dict:
    """
    新增銜接任務
    
    Args:
        from_actor: 來源 (cli 或 agent)
        to_actor: 目標 (cli 或 agent)
        task: 任務描述
        blocking: 是否為阻塞性任務
        context: 額外上下文資訊
    """
    data = load_milestone()
    
    handoff = {
        "from": from_actor,
        "to": to_actor,
        "task": task,
        "blocking": blocking,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if context:
        handoff["context"] = context
    
    data.setdefault("pending_handoff", []).append(handoff)
    data["last_updated_by"] = f"{from_actor}:handoff"
    save_milestone(data)
    return data


def clear_handoff(task_substr: str) -> dict:
    """清除已完成的銜接任務"""
    data = load_milestone()
    data["pending_handoff"] = [
        h for h in data.get("pending_handoff", [])
        if task_substr not in h.get("task", "")
    ]
    save_milestone(data)
    return data


def get_pending_handoffs(to_actor: Optional[ActorType] = None) -> list[dict]:
    """取得待處理的銜接任務"""
    data = load_milestone()
    handoffs = data.get("pending_handoff", [])
    if to_actor:
        handoffs = [h for h in handoffs if h.get("to") == to_actor]
    return handoffs
