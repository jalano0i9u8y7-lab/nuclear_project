from typing import Any, Dict, List, Optional, Set
from pydantic import BaseModel, Field, ConfigDict

"""
M07 Daily D-1..D-4 Pipeline Contracts.
Strict schema enforcement for all daily outputs.
"""

class D1Output(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    news_items: List[Dict[str, Any]] = Field(default_factory=list)
    forum_items: List[Dict[str, Any]] = Field(default_factory=list)
    signals: Dict[str, Any] = Field(default_factory=dict)
    whitelist_used: Dict[str, str] = Field(
        description="Paths to d1a and d1b whitelists used."
    )
    constraints_applied: Dict[str, Any] = Field(
        default_factory=lambda: {"news_per_source_cap": 50, "total_forum_cap": 300},
        description="Caps and filters applied during ingestion."
    )

class D2Output(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    breadth_stub: Dict[str, Any] = Field(default_factory=dict)
    volatility_stub: Dict[str, Any] = Field(default_factory=dict)
    signals: Dict[str, Any] = Field(default_factory=dict)

class D3Output(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    universe_size: int
    shards: int
    per_ticker_stub_index: List[str]
    derivatives_stub: Dict[str, Any] = Field(default_factory=dict)
    signals: Dict[str, Any] = Field(default_factory=dict)

class D4Output(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    macro_prices_stub: Dict[str, Any] = Field(default_factory=dict)
    macro_derivatives_stub: Dict[str, Any] = Field(default_factory=dict)
    signals: Dict[str, Any] = Field(default_factory=dict)

class DailySummaryOutput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    
    date: str = Field(pattern=r"^\d{4}-\d{2}-\d{2}$")
    d1_signals: Dict[str, Any]
    d2_signals: Dict[str, Any]
    d3_signals: Dict[str, Any]
    d4_signals: Dict[str, Any]
    identity_shift_signals_candidate: Dict[str, Any] = Field(default_factory=dict)
    data_gap_watchlist: List[str] = Field(default_factory=list)
    notes: str = ""
