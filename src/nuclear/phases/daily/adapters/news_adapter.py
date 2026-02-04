from abc import ABC, abstractmethod
from typing import Any, Dict, List

class NewsAdapter(ABC):
    @abstractmethod
    def fetch(self, date: str) -> List[Dict[str, Any]]:
        pass

class StubNewsAdapter(NewsAdapter):
    def fetch(self, date: str) -> List[Dict[str, Any]]:
        # Returns tiny list of items from allowed whitelist domains
        return [
            {"date": date, "title": "Fed Holds Rates", "source_domain": "reuters.com", "content": "..."}
        ]
