"""
M20 Reasoning Traces Data Contracts
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

class ReasoningTrace(BaseModel):
    model: str
    text: str
    created_at: datetime

class StoredTraceRef(BaseModel):
    storage_key: str
    model: str
