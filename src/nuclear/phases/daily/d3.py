from typing import List
from nuclear.phases.daily.contracts import D3Output
from nuclear.phases.daily.adapters.d3_ticker_adapter import TickerDerivativeAdapter, StubTickerDerivativeAdapter

def run_d3(date: str, tickers: List[str] = None, shards: int = 1, adapter: TickerDerivativeAdapter = None) -> D3Output:
    """
    D-3: Per-ticker specialist.
    Supports sharding.
    """
    adapter = adapter or StubTickerDerivativeAdapter()
    tickers = tickers or ["AAPL", "MSFT", "NVDA"]
    universe_size = len(tickers)
    
    # Simulate sharding (M07 requirement)
    # If shards > 1, we normally split the workload. 
    # For skeleton, we just record the shard count and the tickers processed.
    
    derivatives = adapter.fetch(date, tickers)
    
    return D3Output(
        date=date,
        universe_size=universe_size,
        shards=shards,
        per_ticker_stub_index=tickers,
        derivatives_stub=derivatives,
        signals={"high_iv_tickers": []}
    )
