from abc import ABC, abstractmethod
from typing import Any, Dict, List

class TickerDerivativeAdapter(ABC):
    @abstractmethod
    def fetch(self, date: str, tickers: List[str]) -> Dict[str, Any]:
        pass

class StubTickerDerivativeAdapter(TickerDerivativeAdapter):
    def fetch(self, date: str, tickers: List[str]) -> Dict[str, Any]:
        # Implementation returns empty dict as per M07 spec
        return {}
