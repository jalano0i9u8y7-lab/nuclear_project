import os
from typing import Optional, Dict, Any
from .base import BaseLLMClient

class OpenRouterClient(BaseLLMClient):
    """OpenRouter client skeleton. Requires OPENROUTER_API_KEY env var."""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.environ.get("OPENROUTER_API_KEY")
        if not self.api_key:
            raise ValueError("OPENROUTER_API_KEY is required for OpenRouterClient")

    @property
    def name(self) -> str:
        return "openrouter"

    def build_headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "https://nuclear.project", # TODO: Valid URL
            "X-Title": "Nuclear Project"
        }

    def generate(self, prompt: str, schema: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        # Skeleton: raises NotImplementedError for M17 to prevent accidental costs
        # Future: Implement requests.post to OpenRouter API
        raise NotImplementedError("OpenRouter generation not yet implemented in M17.")
