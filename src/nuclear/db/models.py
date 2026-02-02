"""SQLAlchemy models - minimal for Alembic migration."""

from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlalchemy import DateTime, Index, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Run(Base):
    __tablename__ = "runs"

    run_id: Mapped[str] = mapped_column(String(64), primary_key=True, default=lambda: str(uuid4()))
    phase: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    stage: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    model_config_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    error_log: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class SnapshotIndex(Base):
    __tablename__ = "snapshots_index"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    phase: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    stage: Mapped[str] = mapped_column(String(32), nullable=False)
    ticker: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(256), nullable=False)
    summary_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    worldview_version: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    __table_args__ = (Index("ix_snapshots_phase_created", "phase", "created_at"),)


class WorldviewIndex(Base):
    __tablename__ = "worldview_index"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    version: Mapped[str] = mapped_column(String(32), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(256), nullable=False)
    summary_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    type: Mapped[str] = mapped_column(String(64), nullable=False)
    ticker: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    triggered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    resolved_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    retention_flag: Mapped[bool] = mapped_column(default=False, nullable=False)

    __table_args__ = (Index("ix_alerts_ticker_triggered", "ticker", "triggered_at"),)


class Quarantine(Base):
    __tablename__ = "quarantine"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    phase: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(256), nullable=False)
    error_summary: Mapped[str] = mapped_column(Text, nullable=False)


class AiOutput(Base):
    """SSOT V8.36: Hermes 4 outputs with reasoning_trace in R2."""

    __tablename__ = "ai_outputs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=lambda: str(uuid4()))
    phase: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    run_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    ticker: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    model_name: Mapped[str] = mapped_column(String(128), nullable=False)
    include_reasoning: Mapped[bool] = mapped_column(default=True, nullable=False)
    final_answer_storage_key: Mapped[str] = mapped_column(String(256), nullable=False)
    reasoning_trace_storage_key: Mapped[Optional[str]] = mapped_column(String(256), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
