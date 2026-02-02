"""Hermes reasoning parser test."""

import pytest

from nuclear.llm.hermes_reasoning_parser import parse_hermes_response


def test_parse_hermes_with_think():
    raw = """<think>
Step 1: Check correlation
Step 2: Compute risk
</think>
Based on analysis, recommend 10% allocation."""
    parsed = parse_hermes_response(raw)
    assert parsed.reasoning_trace is not None
    assert "correlation" in parsed.reasoning_trace
    assert "10% allocation" in parsed.final_answer


def test_parse_hermes_without_think():
    raw = "Direct answer without think tags."
    parsed = parse_hermes_response(raw)
    assert parsed.reasoning_trace is None
    assert parsed.final_answer == raw
