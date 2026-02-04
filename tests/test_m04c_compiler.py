import pytest
import sqlite3
import json
import uuid
from pathlib import Path
from datetime import datetime, timezone, timedelta
from contextlib import closing

from nuclear.learning.compiler import compile_learning_state, run_compiler
from nuclear.learning.candidates import CandidateHardCap, CandidateBannedPattern
from nuclear.learning.candidate_service import persist_candidates
from nuclear.learning.state import save_learning_state, load_learning_state_latest
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

def test_compile_creates_learning_state(clean_db):
    """Test converting candidates to learning state."""
    
    # 1. Seed Candidates
    now_iso = datetime.now(timezone.utc).isoformat()
    c1 = CandidateHardCap(
        candidate_id="c1", level="symbol", proposal="limit AAPL",
        evidence=["ev1"], confidence=0.9, suggested_ttl_days=10,
        generated_at=now_iso, source="test"
    )
    c2 = CandidateBannedPattern(
        candidate_id="c2", level="symbol", proposal="ban TSLA",
        evidence=["ev2"], confidence=0.8, suggested_ttl_days=7,
        generated_at=now_iso, source="test"
    )
    persist_candidates([c1, c2])
    
    # 2. Run Compiler
    state = run_compiler()
    
    # 3. Verify Output
    assert state is not None
    assert state.version == 1
    assert len(state.policy_hard_caps) == 1
    assert state.policy_hard_caps[0].rule == "limit AAPL"
    assert len(state.policy_banned_patterns) == 1
    # Check signature mapping for BannedPattern
    assert state.policy_banned_patterns[0].signature == "ban TSLA"
    assert "compiled_candidates: 2 items" in state.context_signature_summary

def test_compiler_deterministic_idempotency(clean_db):
    """Verify compiler doesn't create new versions if nothing changed."""
    
    # 1. Seed Candidates & Initial Compile
    now_iso = datetime.now(timezone.utc).isoformat()
    c1 = CandidateHardCap(
        candidate_id="c1", level="symbol", proposal="limit AAPL",
        evidence=["ev1"], confidence=0.9, suggested_ttl_days=10,
        generated_at=now_iso, source="test"
    )
    persist_candidates([c1])
    
    state1 = compile_learning_state()
    assert state1.version == 1
    
    # 2. Run Compiler Again (No new candidates)
    state2 = compile_learning_state()
    
    # Expectation: PREFER IDEMPOTENT -> Returns None (skipped)
    assert state2 is None
    
    # Verify DB still has only version 1
    latest = load_learning_state_latest()
    assert latest.version == 1
    
    # 3. Add NEW Candidate
    c2 = CandidateHardCap(
        candidate_id="c2", level="symbol", proposal="limit MSFT",
        evidence=["ev2"], confidence=0.95, suggested_ttl_days=10,
        generated_at=now_iso, source="test"
    )
    persist_candidates([c2])
    
    # 4. Run Compiler Again
    state3 = compile_learning_state()
    assert state3 is not None
    assert state3.version == 2 # Incremented
    assert len(state3.policy_hard_caps) == 2

def test_compiler_candidates_untouched(clean_db):
    """Ensure candidate log size is constant."""
    persist_candidates([
        CandidateHardCap(
            candidate_id="c1", level="system", proposal="stub",
            evidence=[], confidence=0.5, suggested_ttl_days=1,
            generated_at=datetime.now(timezone.utc).isoformat(), source="test"
        )
    ])
    
    run_compiler()
    
    with closing(SQLiteEngine.connect()) as conn:
        count = conn.execute("SELECT count(*) FROM learning_candidates_log").fetchone()[0]
        assert count == 1 # Still there

def test_de_duplication_logic(clean_db):
    """Ensure compiler picks higher confidence for same proposal."""
    now_iso = datetime.now(timezone.utc).isoformat()
    
    # Two candidates, same proposal, diff confidence
    c1 = CandidateHardCap(
        candidate_id="c1", level="symbol", proposal="limit AAPL",
        evidence=["ev1"], confidence=0.5, suggested_ttl_days=10,
        generated_at=now_iso, source="weak"
    )
    c2 = CandidateHardCap(
        candidate_id="c2", level="symbol", proposal="limit AAPL",
        evidence=["ev2"], confidence=0.9, suggested_ttl_days=10,
        generated_at=now_iso, source="strong"
    )
    persist_candidates([c1, c2])
    
    state = run_compiler()
    assert len(state.policy_hard_caps) == 1
    # Should contain the evidence/confidence from the stronger one
    assert state.policy_hard_caps[0].confidence == 0.9
    assert "ev2" in state.policy_hard_caps[0].evidence
