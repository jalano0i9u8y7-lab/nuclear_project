from abc import ABC, abstractmethod
from typing import Optional, Dict, Any

class BaseLLMClient(ABC):
    """Abstract base class for LLM clients."""
    
    @property
    @abstractmethod
    def name(self) -> str:
        pass

    @abstractmethod
    def generate(self, prompt: str, schema: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Generate a structured response from the LLM.
        Args:
            prompt: The text prompt.
            schema: Optional JSON schema to enforce structure.
        Returns:
            Dict containing the response.
        """
        pass
