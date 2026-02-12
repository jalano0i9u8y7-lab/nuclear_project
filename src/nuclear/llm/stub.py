from typing import Optional, Dict, Any
from .base import BaseLLMClient

class StubLLMClient(BaseLLMClient):
    """Deterministic stub client for testing/dev without API keys."""
    
    @property
    def name(self) -> str:
        return "stub"

    def generate(self, prompt: str, schema: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        return {
            "text": "stub response",
            "confidence": 0.5,
            "reasoning": "stub reasoning trace",
            "metadata": {
                "engine": "stub",
                "schema_used": bool(schema)
            }
        }
