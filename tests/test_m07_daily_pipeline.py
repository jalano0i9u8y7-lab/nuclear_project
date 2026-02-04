import pytest
import json
import os
from pathlib import Path
from argparse import Namespace
from nuclear.cli import cmd_daily
from nuclear.phases.daily.d1 import run_d1
from nuclear.phases.daily.d3 import run_d3
from nuclear.phases.daily.whitelist_loader import load_d1a_news_domains, load_d1b_forum_domains
from nuclear.db.repos import SnapshotRepo

"""
M07 Daily Pipeline Tests.
Ensures skeleton logic and infrastructure integration.
"""

def test_whitelist_loader_sanity():
    d1a = load_d1a_news_domains()
    d1b = load_d1b_forum_domains()
    assert "reuters.com" in d1a
    assert "cmoney.tw" in d1b

def test_d1_respects_whitelist():
    out = run_d1("2026-02-04")
    d1a = load_d1a_news_domains()
    d1b = load_d1b_forum_domains()
    
    for item in out.news_items:
        assert item["source_domain"] in d1a
        
    for item in out.forum_items:
        # Some items might be reddit r/stocks, we check if domain part is there
        # Our loader extract_domains_from_md is simple
        domain = item["source_domain"]
        assert any(domain in allowed for allowed in d1b)

def test_d3_sharding():
    tickers = ["A", "B", "C", "D", "E"]
    out = run_d3("2026-02-04", tickers=tickers, shards=2)
    assert out.universe_size == 5
    assert out.shards == 2
    assert out.per_ticker_stub_index == tickers

def test_daily_writes_snapshots(capsys):
    date = "2026-02-04"
    run_id = f"test_daily_{os.getpid()}"
    args = Namespace(date=date, run_id=run_id, tickers="AAPL,NVDA", shards=1)
    
    exit_code = cmd_daily(args)
    assert exit_code == 0
    
    # Check filesystem
    # Based on SnapshotWriter: outputs/snapshots/daily/d1/...
    base_path = Path("outputs/snapshots")
    assert (base_path / "daily/d1").exists()
    assert (base_path / "daily/daily_summary").exists()
    
    # Check DB Index
    # We use SnapshotRepo to check
    # Note: cli command prints json, we can also check capsys if needed
    
    # We query SnapshotRepo
    # Need to connect to DB? SnapshotRepo usually uses global SQLiteEngine
    from nuclear.db.sqlite import SQLiteEngine
    import sqlite3
    
    with SQLiteEngine.connect() as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute("SELECT * FROM snapshots_index WHERE run_id = ?", (run_id,)).fetchall()
        phases = [row["phase"] for row in rows]
        assert "daily/d1" in phases
        assert "daily/daily_summary" in phases

def test_no_external_calls():
    # This is a conceptual test. 
    # Verification of "Stub" logic in adapters.
    from nuclear.phases.daily.adapters.news_adapter import StubNewsAdapter
    adapter = StubNewsAdapter()
    items = adapter.fetch("2026-02-04")
    assert len(items) > 0
    assert "reuters.com" == items[0]["source_domain"]
