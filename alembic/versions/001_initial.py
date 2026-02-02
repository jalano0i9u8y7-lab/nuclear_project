"""Initial - runs, snapshots_index, worldview_index, alerts, quarantine, ai_outputs.

Revision ID: 001
Revises:
Create Date: 2026-02-01

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "runs",
        sa.Column("run_id", sa.String(64), primary_key=True),
        sa.Column("phase", sa.String(32), nullable=False, index=True),
        sa.Column("stage", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, index=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("model_config_json", sa.JSON(), nullable=True),
        sa.Column("error_log", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
    )
    op.create_index("ix_runs_phase_started", "runs", ["phase", "started_at"], unique=False)

    op.create_table(
        "snapshots_index",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("phase", sa.String(32), nullable=False, index=True),
        sa.Column("stage", sa.String(32), nullable=False),
        sa.Column("ticker", sa.String(32), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("version", sa.String(32), nullable=False),
        sa.Column("storage_key", sa.String(256), nullable=False),
        sa.Column("summary_json", sa.JSON(), nullable=True),
        sa.Column("worldview_version", sa.String(64), nullable=True),
    )
    op.create_index("ix_snapshots_phase_created", "snapshots_index", ["phase", "created_at"], unique=False)
    op.create_index("ix_snapshots_ticker_created", "snapshots_index", ["ticker", "created_at"], unique=False)

    op.create_table(
        "worldview_index",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("version", sa.String(32), nullable=False),
        sa.Column("storage_key", sa.String(256), nullable=False),
        sa.Column("summary_json", sa.JSON(), nullable=True),
    )

    op.create_table(
        "alerts",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("type", sa.String(64), nullable=False),
        sa.Column("ticker", sa.String(32), nullable=True, index=True),
        sa.Column("severity", sa.String(32), nullable=False),
        sa.Column("triggered_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("retention_flag", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index("ix_alerts_ticker_triggered", "alerts", ["ticker", "triggered_at"], unique=False)

    op.create_table(
        "quarantine",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("phase", sa.String(32), nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("storage_key", sa.String(256), nullable=False),
        sa.Column("error_summary", sa.Text(), nullable=False),
    )

    op.create_table(
        "ai_outputs",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("phase", sa.String(32), nullable=False, index=True),
        sa.Column("run_id", sa.String(64), nullable=True, index=True),
        sa.Column("ticker", sa.String(32), nullable=True, index=True),
        sa.Column("model_name", sa.String(128), nullable=False),
        sa.Column("include_reasoning", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("final_answer_storage_key", sa.String(256), nullable=False),
        sa.Column("reasoning_trace_storage_key", sa.String(256), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("ai_outputs")
    op.drop_table("quarantine")
    op.drop_table("alerts")
    op.drop_table("worldview_index")
    op.drop_table("snapshots_index")
    op.drop_table("runs")
