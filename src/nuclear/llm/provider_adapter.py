"""LLM provider adapter - call/batch abstraction, include_reasoning for Hermes 4."""

from typing import Any, Optional

from nuclear.llm.hermes_reasoning_parser import parse_hermes_response


def call_hermes_with_reasoning(
    messages: list[dict[str, str]],
    model: str = "nousresearch/hermes-4-405b",
    include_reasoning: bool = True,
) -> dict[str, Any]:
    """
    Call Hermes 4 with include_reasoning=true.
    SSOT: All Hermes 4 calls must enable include_reasoning.
    """
    # Skeleton - implement with httpx + tenacity
    payload = {
        "model": model,
        "messages": messages,
        "include_reasoning": include_reasoning,
    }
    return {"payload": payload, "parsed": None}


def parse_and_store_reasoning(raw_content: str) -> tuple[str | None, str]:
    """
    Parse Hermes response, return (reasoning_trace, final_answer).
    SSOT V8.42: contract/storage for include_reasoning + reasoning_trace.
    TODO: Persist reasoning_trace to R2 or DB (AiOutput.reasoning_trace_storage_key);
          wire real LLM call -> parse_hermes_response -> save to ai_outputs.
    """
    parsed = parse_hermes_response(raw_content)
    return parsed.reasoning_trace, parsed.final_answer
