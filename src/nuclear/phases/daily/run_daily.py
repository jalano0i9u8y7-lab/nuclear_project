import structlog
from typing import List, Optional
from nuclear.phases.daily.contracts import DailySummaryOutput
from nuclear.phases.daily.d1 import run_d1
from nuclear.phases.daily.d2 import run_d2
from nuclear.phases.daily.d3 import run_d3
from nuclear.phases.daily.d4 import run_d4
from nuclear.storage.snapshot import SnapshotWriter

log = structlog.get_logger()

def run_daily_pipeline(date: str, tickers: Optional[List[str]] = None, shards: int = 1, run_id: str = "daily_run") -> DailySummaryOutput:
    """
    Orchestrates D-1..D-4 and persists snapshots.
    """
    log.info("Starting Daily Pipeline", date=date, run_id=run_id)
    writer = SnapshotWriter()
    
    # 1. Run D-1
    d1 = run_d1(date)
    writer.save(phase="daily/d1", payload=d1.model_dump(), run_id=run_id)
    
    # 2. Run D-2
    d2 = run_d2(date)
    writer.save(phase="daily/d2", payload=d2.model_dump(), run_id=run_id)
    
    # 3. Run D-3
    d3 = run_d3(date, tickers=tickers, shards=shards)
    writer.save(phase="daily/d3", payload=d3.model_dump(), run_id=run_id)
    
    # 4. Run D-4
    d4 = run_d4(date)
    writer.save(phase="daily/d4", payload=d4.model_dump(), run_id=run_id)
    
    # 5. Create Summary
    summary = DailySummaryOutput(
        date=date,
        d1_signals=d1.signals,
        d2_signals=d2.signals,
        d3_signals=d3.signals,
        d4_signals=d4.signals,
        notes="Daily pipeline skeleton run completed."
    )
    writer.save(phase="daily/daily_summary", payload=summary.model_dump(), run_id=run_id)
    
    log.info("Daily Pipeline Finished", date=date)
    return summary
