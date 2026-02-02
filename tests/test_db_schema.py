"""DB schema test - models load, table metadata."""

from nuclear.db.models import Alert, AiOutput, Quarantine, Run, SnapshotIndex, WorldviewIndex


def test_models_exist():
    assert Run.__tablename__ == "runs"
    assert SnapshotIndex.__tablename__ == "snapshots_index"
    assert WorldviewIndex.__tablename__ == "worldview_index"
    assert Alert.__tablename__ == "alerts"
    assert Quarantine.__tablename__ == "quarantine"
    assert AiOutput.__tablename__ == "ai_outputs"


def test_alert_retention_flag():
    assert "retention_flag" in Alert.__table__.columns
