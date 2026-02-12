import os
from typing import Dict, Any, Optional
from .base import BaseLLMClient
from .stub import StubLLMClient
from .stub import StubLLMClient
# from .openrouter import OpenRouterClient # Deprecated M17 skeleton

class LLMRouter:
    """
    Routes requests to appropriate LLM backend.
    Default: Stub (safeguard).
    If env OPENROUTER_API_KEY is present, tries OpenRouter.
    """
    
    def __init__(self):
        self.client: BaseLLMClient = self._initialize_client()

    def _initialize_client(self) -> BaseLLMClient:
        network_enabled = os.environ.get("NUCLEAR_LLM_NETWORK", "0") == "1"
        key = os.environ.get("OPENROUTER_API_KEY")
        
        if network_enabled:
            if key and key.strip():
                try:
                    from .openrouter_client import OpenRouterClient
                    
                    # Read model and provider from .env
                    model = os.environ.get("DEFAULT_ANALYST_MODEL") or os.environ.get("OPENROUTER_MODEL")
                    provider = os.environ.get("DEFAULT_ANALYST_PROVIDER")
                    provider_order = [provider] if provider else None
                    
                    return OpenRouterClient(api_key=key, model=model, provider_order=provider_order)
                except Exception as e:
                    # Log error but fallback
                    import structlog
                    log = structlog.get_logger()
                    log.error("openrouter_init_failed", error=str(e))
                    return StubLLMClient()
            else:
                 import structlog
                 log = structlog.get_logger()
                 log.warning("NUCLEAR_LLM_NETWORK=1 but OPENROUTER_API_KEY missing. Fallback to Stub.")
                 return StubLLMClient()
        
        return StubLLMClient()

    @property
    def active_client_name(self) -> str:
        return self.client.name

    def generate(self, prompt: str, schema: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        result = self.client.generate(prompt, schema)
        
        # M20 Reasoning Trace Storage
        if "reasoning" in result and result["reasoning"]:
            try:
                from nuclear.llm.traces import ReasoningTrace, StoredTraceRef
                from nuclear.storage.reasoning import write_reasoning_trace
                from datetime import datetime, timezone
                
                trace = ReasoningTrace(
                    model=self.active_client_name,
                    text=result["reasoning"],
                    created_at=datetime.now(timezone.utc)
                )
                
                ref_key = write_reasoning_trace(trace)
                
                result["reasoning_trace_ref"] = StoredTraceRef(
                    storage_key=ref_key,
                    model=trace.model
                )
            except Exception as e:
                # Never block main flow
                import structlog
                log = structlog.get_logger()
                log.error("reasoning_trace_write_failed", error=str(e))
                
        return result

# Singleton instance for easy import
router = LLMRouter()

def get_router() -> LLMRouter:
    return router
