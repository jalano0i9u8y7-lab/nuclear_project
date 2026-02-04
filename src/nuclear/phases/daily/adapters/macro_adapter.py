from abc import ABC, abstractmethod
from typing import Any, Dict

class MacroAdapter(ABC):
    @abstractmethod
    def fetch(self, date: str) -> Dict[str, Any]:
        pass

class StubMacroAdapter(MacroAdapter):
    def fetch(self, date: str) -> Dict[str, Any]:
        # Returns empty dict as per M07 spec
        return {}
