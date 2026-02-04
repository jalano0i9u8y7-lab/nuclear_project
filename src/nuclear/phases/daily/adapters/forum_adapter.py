from abc import ABC, abstractmethod
from typing import Any, Dict, List

class ForumAdapter(ABC):
    @abstractmethod
    def fetch(self, date: str) -> List[Dict[str, Any]]:
        pass

class StubForumAdapter(ForumAdapter):
    def fetch(self, date: str) -> List[Dict[str, Any]]:
        # Returns tiny list of items from authorized forum domains
        return [
            {"date": date, "title": "NVDA to the moon", "source_domain": "reddit.com", "content": "..."}
        ]
