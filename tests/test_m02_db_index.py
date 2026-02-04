import pytest
import sqlite3
import shutil
from pathlib import Path
from nuclear.cli import cmd_wb_flow
from nuclear.db.sqlite import SQLiteEngine
from argparse import Namespace
from contextlib import closing

DB_PATH = Path("outputs/nuclear.db")

@pytest.fixture
def clean_db():
    if DB_PATH.exists():
        DB_PATH.unlink()
    # Reset persistent conn if any
    yield
    # Cleanup not strictly needed in dev

def test_run_and_snapshot_index_created(clean_db):
    """Verify wb flow creates DB records."""
    # Use CLI entry point to simulate full flow
    args = Namespace(run_id=None) 
    assert cmd_wb_flow(args) == 0
    
    assert DB_PATH.exists()
    
    assert DB_PATH.exists()
    
    with closing(SQLiteEngine.connect()) as conn:
        conn.row_factory = sqlite3.Row
        c = conn.cursor()
        
        # Check Run
        runs = c.execute("SELECT * FROM runs").fetchall()
        assert len(runs) == 1
        assert runs[0]["status"] == "completed"
        run_id = runs[0]["run_id"]
        
        # Check Snapshots
        snaps = c.execute("SELECT * FROM snapshots_index WHERE run_id=?", (run_id,)).fetchall()
        assert len(snaps) >= 2 # wb1 and wb2
        
        phases = [r["phase"] for r in snaps]
        assert "wb1" in phases
        assert "wb2" in phases

def test_payload_sha256_present(clean_db):
    """Verify SHA256 is computed."""
    cmd_wb_flow(Namespace(run_id=None))
    
    with closing(SQLiteEngine.connect()) as conn:
        conn.row_factory = sqlite3.Row
        snaps = conn.execute("SELECT * FROM snapshots_index").fetchall()
        
        assert len(snaps) > 0
        for s in snaps:
            assert s["payload_sha256"] is not None
            assert len(s["payload_sha256"]) == 64 # Hex digest length

def test_append_only_snapshot_index(clean_db):
    """Verify multiple runs accumulate records."""
    cmd_wb_flow(Namespace(run_id=None))
    cmd_wb_flow(Namespace(run_id=None))
    
    with closing(SQLiteEngine.connect()) as conn:
        runs = conn.execute("SELECT count(*) FROM runs").fetchone()[0]
        snaps = conn.execute("SELECT count(*) FROM snapshots_index").fetchone()[0]
        
        assert runs == 2
        assert snaps >= 4 # 2 runs * 2 snapshots (wb1+wb2)
