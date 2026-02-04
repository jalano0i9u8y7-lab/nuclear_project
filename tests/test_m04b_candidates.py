import pytest
import sqlite3
import json
from pathlib import Path
from datetime import datetime, timezone
from contextlib import closing

from nuclear.learning.candidates import (
    BaseCandidate, CandidateHardCap, CandidateBannedPattern
)
from nuclear.learning.candidate_service import generate_candidates, persist_candidates
from nuclear.learning.state import load_learning_state_latest, save_learning_state
from nuclear.learning.schemas import LearningStateLatest
from nuclear.db.schema import create_tables
from nuclear.db.sqlite import SQLiteEngine

DB_PATH = Path("outputs/nuclear.db")

@pytest.fixture
def clean_db():
    if DB_PATH.exists():
        DB_PATH.unlink()
    create_tables()
    yield

def test_candidate_generation():
    """Test observer logic with stub data."""
    context = {
        "history_samples": [
            {"date": "2023-01-01", "drawdown": 0.25, "symbol": "AAPL", "reversals_7d": 1},
            {"date": "2023-01-02", "drawdown": 0.1, "symbol": "TSLA", "reversals_7d": 4}
        ]
    }
    
    candidates = generate_candidates(context)
    
    # Expect 1 hard cap (AAPL drawdown > 0.2)
    # Expect 1 banned pattern (TSLA reversals > 3)
    
    assert len(candidates) == 2
    
    caps = [c for c in candidates if c.category == "hard_cap"]
    bans = [c for c in candidates if c.category == "banned_pattern"]
    
    assert len(caps) == 1
    assert "AAPL" in caps[0].proposal
    assert caps[0].source == "drawdown_observer"
    
    assert len(bans) == 1
    assert "TSLA" in bans[0].proposal
    assert bans[0].source == "churn_observer"

def test_candidate_persistence(clean_db):
    """Test saving candidates to log."""
    cand = CandidateHardCap(
        candidate_id="test-123",
        level="symbol",
        proposal="Test Proposal",
        evidence=["ev1"],
        confidence=0.5,
        suggested_ttl_days=10,
        generated_at=datetime.now(timezone.utc).isoformat(),
        source="test"
    )
    
    count = persist_candidates([cand])
    assert count == 1
    
    with closing(SQLiteEngine.connect()) as conn:
        row = conn.execute("SELECT * FROM learning_candidates_log WHERE candidate_id=?", ("test-123",)).fetchone()
        assert row is not None
        assert row[3] == "Test Proposal" # Index 3 is proposal
        
        # Verify JSON payload
        data = json.loads(row[4])
        assert data["candidate_id"] == "test-123"

def test_no_learning_state_modified(clean_db):
    """Ensure generating/persisting candidates touches ONLY valid log."""
    
    # 1. Setup initial state
    now_iso = datetime.now(timezone.utc).isoformat()
    state = LearningStateLatest(
        version=1, generated_at=now_iso, context_signature_summary="init",
        policy_hard_caps=[], policy_soft_bias=[], policy_banned_patterns=[],
        fail_signatures_topK=[], data_gap_watchlist=[], evidence_index=[],
        ttl_days=1, half_life_days=1
    )
    save_learning_state(state)
    
    # 2. Run Candidate Service
    context = {
        "history_samples": [{"drawdown": 0.5, "symbol": "BAD_ASSET"}]
    }
    cands = generate_candidates(context)
    persist_candidates(cands)
    
    # 3. Verify State is UNCHANGED
    loaded = load_learning_state_latest()
    assert loaded.version == 1
    assert loaded.context_signature_summary == "init"
    
    # 4. Verify Candidates ARE logged
    with closing(SQLiteEngine.connect()) as conn:
        c_count = conn.execute("SELECT count(*) FROM learning_candidates_log").fetchone()[0]
        assert c_count == 1
        
        # 5. Verify State Log didn't grow (only 1 from setup)
        s_count = conn.execute("SELECT count(*) FROM learning_state_log").fetchone()[0]
        assert s_count == 1
