"""Pydantic v2 schemas - I/O validation."""

from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class Run(BaseModel):
    run_id: str
    phase: str
    stage: str
    status: str
    started_at: datetime
    finished_at: Optional[datetime] = None
    model_config_json: Optional[dict[str, Any]] = None
    error_log: Optional[str] = None
    metadata_json: Optional[dict[str, Any]] = None


class SnapshotIndex(BaseModel):
    id: UUID
    phase: str
    stage: str
    ticker: Optional[str] = None
    created_at: datetime
    version: str
    storage_key: str
    summary_json: Optional[dict[str, Any]] = None
    worldview_version: Optional[str] = None


class WorldviewIndex(BaseModel):
    id: UUID
    created_at: datetime
    version: str
    storage_key: str
    summary_json: Optional[dict[str, Any]] = None


class Alert(BaseModel):
    id: UUID
    type: str
    ticker: Optional[str] = None
    severity: str
    triggered_at: datetime
    resolved_at: Optional[datetime] = None
    message: Optional[str] = None
    metadata_json: Optional[dict[str, Any]] = None


class WB1Output(BaseModel):
    """SSOT V8.42: WB-1 output contract - all 8 fields required."""

    worldview_version: str = Field(..., description="SSOT: WB-1 output")
    world_state_snapshot: dict[str, Any] = Field(default_factory=dict)
    asset_identity_map: dict[str, Any] = Field(default_factory=dict)
    narrative_map: dict[str, Any] = Field(default_factory=dict)
    identity_shift_signals_summary: dict[str, Any] = Field(default_factory=dict)
    framework_stability_score: Optional[float] = None
    rebuild_recommendation: Optional[bool] = None
    rebuild_reason_top5: list[str] = Field(default_factory=list)


class IdentityContext(BaseModel):
    """SSOT: WB-2 each order must have identity_context (e.g. Gold as risk-on momentum)."""

    asset_id: str
    identity_label: str
    narrative: Optional[str] = None


class OrderPlan(BaseModel):
    """SSOT: WB-2 order with worldview_version + identity_context."""

    ticker: str
    worldview_version: str = Field(..., description="SSOT: each order must reference")
    identity_context: IdentityContext = Field(..., description="SSOT: each order must have")
    action: Optional[str] = None  # e.g. HOLD, NO_TRADE
    buy_ladder: list[float] = Field(default_factory=list)
    sell_ladder: list[float] = Field(default_factory=list)
    parameter_adjustment: Optional[dict[str, Any]] = None
