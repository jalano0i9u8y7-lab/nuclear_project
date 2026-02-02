"""Hermes 4 reasoning parser - extract <think> to reasoning_trace, rest to final_answer."""

import re
from dataclasses import dataclass


@dataclass
class HermesParsed:
    reasoning_trace: str | None
    final_answer: str


def parse_hermes_response(raw_content: str) -> HermesParsed:
    """
    SSOT: Parser extracts <think> to reasoning_trace, rest to final_answer.
    Do NOT let OpenRouter filter think tags.
    """
    think_match = re.search(r"<think>(.*?)</think>", raw_content, re.DOTALL)
    if think_match:
        reasoning_trace = think_match.group(1).strip()
        final_answer = re.sub(r"<think>.*?</think>", "", raw_content, flags=re.DOTALL).strip()
    else:
        reasoning_trace = None
        final_answer = raw_content.strip()
    return HermesParsed(reasoning_trace=reasoning_trace, final_answer=final_answer)
