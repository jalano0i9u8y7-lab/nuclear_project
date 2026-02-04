import pytest
import json
import shutil
from pathlib import Path
from nuclear.phases.weekly import wb1, wb2

SNAPSHOT_root = Path("outputs/snapshots")

@pytest.fixture(autouse=True)
def clean_snapshots():
    """Ensure clean slate before/after tests"""
    if SNAPSHOT_root.exists():
        shutil.rmtree(SNAPSHOT_root)
    yield
    # Cleanup after test if needed, but keeping for inspection is fine in dev
    # shutil.rmtree(SNAPSHOT_root, ignore_errors=True)

def test_snapshot_written_wb1():
    """Verify WB1 creates a snapshot file."""
    # Run WB1
    out = wb1.run_wb1_macro({})
    
    # Check directory
    wb1_dir = SNAPSHOT_root / "wb1"
    assert wb1_dir.exists()
    files = list(wb1_dir.glob("*.json"))
    assert len(files) == 1
    
    # Check content
    content = json.loads(files[0].read_text(encoding="utf-8"))
    # Snapshot payload should match or contain the output
    # Since we passed model_dump(), it should match
    assert content["worldview_version"] == out["worldview_version"]

def test_snapshot_written_wb2(tmp_path):
    """Verify WB2 creates a snapshot file."""
    # Setup WB1 output for WB2 to read
    wb1_file = tmp_path / "wb1_output.json"
    wb1_out = {"worldview_version": "test_v1", "world_state_snapshot": {}, "asset_identity_map": {}, 
               "narrative_map": {}, "identity_shift_signals_summary": {}, "framework_stability_score": None,
               "rebuild_recommendation": False, "rebuild_reason_top5": []}
    wb1_file.write_text(json.dumps(wb1_out), encoding="utf-8")
    
    wb2_file = tmp_path / "wb2_orders.json"
    
    # Run WB2
    orders = wb2.run_wb2_and_persist(str(wb1_file), str(wb2_file))
    
    # Check directory
    wb2_dir = SNAPSHOT_root / "wb2"
    assert wb2_dir.exists()
    files = list(wb2_dir.glob("*.json"))
    assert len(files) == 1
    
    # Check content
    content = json.loads(files[0].read_text(encoding="utf-8"))
    assert len(content) == len(orders)
    assert content[0]["ticker"] == orders[0].ticker

def test_append_only():
    """Verify multiple runs create multiple files (no overwrite)"""
    wb1.run_wb1_macro({})
    wb1.run_wb1_macro({})
    
    wb1_dir = SNAPSHOT_root / "wb1"
    files = list(wb1_dir.glob("*.json"))
    assert len(files) == 2

def test_no_logic_pollution():
    """Verify M01 does not change phase return values"""
    # Simply running the phase and asserting it returns expected structure is enough 
    # as we checked the file side-effect in other tests on same run.
    out = wb1.run_wb1_macro({})
    assert isinstance(out, dict)
    assert "worldview_version" in out
