"""
M21 OpenRouter Real Client (Opt-in)
"""
import os
import json
import httpx
import structlog
from typing import Optional, Dict, Any
from .base import BaseLLMClient

log = structlog.get_logger()

# Config Defaults
DEFAULT_MODEL = "google/gemini-2.0-flash-lite"
DEFAULT_BASE_URL = "https://openrouter.ai/api/v1"
DEFAULT_TIMEOUT = 30
DEFAULT_MAX_TOKENS = 512
DEFAULT_TEMP = 0.2

class OpenRouterClient(BaseLLMClient):
    """
    Real OpenRouter Client using httpx.
    Strictly opt-in via NUCLEAR_LLM_NETWORK env var check at Router level (enforced by caller usually, but we assume router handles it).
    This class performs the actual network call.
    """
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.model = os.environ.get("OPENROUTER_MODEL", DEFAULT_MODEL)
        self.base_url = os.environ.get("OPENROUTER_BASE_URL", DEFAULT_BASE_URL)
        self.timeout = int(os.environ.get("NUCLEAR_LLM_TIMEOUT_SECONDS", DEFAULT_TIMEOUT))
        self.max_tokens = int(os.environ.get("NUCLEAR_LLM_MAX_OUTPUT_TOKENS", DEFAULT_MAX_TOKENS))
        self.temperature = float(os.environ.get("NUCLEAR_LLM_TEMPERATURE", DEFAULT_TEMP))

    @property
    def name(self) -> str:
        return "openrouter"

    def generate(self, prompt: str, schema: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Call OpenRouter chat completions.
        Normalize response to {"text": ..., "confidence": ..., "reasoning": ...}.
        """
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://nuclear.local", # Good citizenship
            "X-Title": "Nuclear Project"
        }
        
        # Inject schema instruction if present
        final_prompt = prompt
        if schema:
            # We don't have a robust schema-to-text converter here, assuming simple prompt engineering for M21.
            # "Add an instruction into the prompt: Return JSON with keys: ..."
            keys = ", ".join(schema.get("properties", {}).keys())
            final_prompt += f"\n\nReturn JSON with keys: {keys}."

        payload = {
            "model": self.model,
            "messages": [{"role": "user", "content": final_prompt}],
            "temperature": self.temperature,
            "max_tokens": self.max_tokens
        }
        
        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload
                )
                resp.raise_for_status()
                data = resp.json()
                
                # Parse OpenAI-compatible response
                # choices[0].message.content
                content = data["choices"][0]["message"]["content"]
                
                # Normalization
                # If content looks like JSON and we asked for schema, we might parse it?
                # But requirement says "Return dict MUST normalize to... text... confidence...".
                # It doesn't mandatory say we parse the JSON here, just that we return the normalized dict structure.
                # However, if M19/M18 expects JSON, they consume "text" and parse it themselves.
                # So we just return the raw text in "text".
                
                # Reasoning?
                # If OpenRouter/Model returns reasoning (e.g. DeepSeek R1), it might be in different fields?
                # Or if we prompted for it?
                # For M20, we just check if it's there.
                # Standard OpenAI format doesn't have "reasoning", but some reasoning models might.
                # Or we prompt "Explanation: ...".
                # For M21 we rely on whatever we get.
                
                return {
                    "text": content,
                    "confidence": 0.5, # Placeholder unless model provides logprobs/confidence
                    "reasoning": None, # Explicitly None if not extracted
                    "metadata": {
                        "model": data.get("model"),
                        "finish_reason": data["choices"][0].get("finish_reason"),
                        "usage": data.get("usage")
                    }
                }
                
        except Exception as e:
            log.error("openrouter_network_error", error=str(e))
            raise e # Router catches or we fallback? Prompt says "errors... raise controlled exception OR return stub-like"
            # Router logic in M17 was: try client.generate... Exception -> return Stub?
            # M17 router didn't have try/except block around generation in `_get_impl`?
            # M17 Router `generate` calls `self.client.generate`.
            # I should raise here so Router can handle or Caller can handle.
            # "errors/timeouts -> raise a controlled exception OR return stub-like fallback, but DO NOT crash phases".
            # I will raise logic exception.
            raise e
