import pytest
import json
import shutil
from pathlib import Path
from nuclear.history.reconcile import reconcile_history, load_recent_snapshots
from nuclear.storage.snapshot import SnapshotWriter
from nuclear.db.schema import create_tables
from nuclear.db.sqlite import SQLiteEngine

DB_PATH = Path("outputs/nuclear.db")
SNAPSHOT_ROOT = Path("outputs/snapshots")

@pytest.fixture
def clean_env():
    if DB_PATH.exists():
        DB_PATH.unlink()
    if SNAPSHOT_ROOT.exists():
        shutil.rmtree(SNAPSHOT_ROOT)
    create_tables()
    yield

def create_dummy_snapshot(phase, payload, run_id="test_run"):
    """Helper to write a snapshot"""
    return SnapshotWriter().save(phase=phase, payload=payload, run_id=run_id)

def test_reconciliation_ok(clean_env):
    """3 compatible snapshots -> OK"""
    base_payload = {"key1": "val1", "key2": 100}
    
    create_dummy_snapshot("wb1", base_payload)
    create_dummy_snapshot("wb1", base_payload)
    create_dummy_snapshot("wb1", base_payload)
    
    res = reconcile_history("wb1", window_size=3)
    assert res.continuity_status == "ok"
    assert len(res.snapshots_used) == 3
    assert not res.detected_breaks

def test_reconciliation_incomplete(clean_env):
    """Only 1 snapshot -> Incomplete"""
    create_dummy_snapshot("wb1", {"k": "v"})
    
    res = reconcile_history("wb1", window_size=3)
    assert res.continuity_status == "incomplete"
    assert len(res.snapshots_used) == 1

def test_reconciliation_break(clean_env):
    """Missing key in one snapshot -> Broken"""
    # Latest snapshot has k1, k2
    # Older snapshot has k1 only
    # Wait, compare_structures logic: compares older AGAINST latest.
    # If latest has k1, k2. Older has k1.
    # Missing in older (vs latest)? No, older has k1. Latest has k1, k2.
    # Missing in older = set() - {k1} ?? No.
    # older keys {k1}. latest keys {k1, k2}.
    # missing_in_older (needed by latest) = {k1, k2} - {k1} = {k2}.
    # Logic in reconcile.py: 
    # missing_in_current (older) = latest_keys - current_keys
    # missing_in_latest = current_keys - latest_keys
    
    # So if latest introduced a NEW key k2, older doesn't have it.
    # missing_in_current = {k2}. -> "Snapshot -X missing keys present in latest: {k2}" -> BREAK.
    # This implies strict schema evolution (adding keys is a break). 
    # Spec says "Top-level schema shape changes" is a break.
    
    # Create older first (created_at is used for order DESC)
    # Actually SnapshotWriter uses datetime.now(). So first call = older.
    create_dummy_snapshot("wb1", {"k1": "v"}) # Oldest
    create_dummy_snapshot("wb1", {"k1": "v", "k2": "new"}) # Latest
    
    res = reconcile_history("wb1", window_size=3)
    
    assert res.continuity_status == "broken"
    assert "detected_breaks" in res.model_dump()
    assert len(res.detected_breaks) > 0
    assert "k2" in res.detected_breaks[0]

def test_no_snapshot_mutation(clean_env):
    """Ensure read-only access"""
    meta = create_dummy_snapshot("wb1", {"data": 123})
    path = Path(meta.payload_ref)
    mtime_before = path.stat().st_mtime
    
    reconcile_history("wb1")
    
    mtime_after = path.stat().st_mtime
    assert mtime_before == mtime_after
