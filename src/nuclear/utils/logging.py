"""Structured logging."""

import structlog

structlog.configure(
    processors=[
        structlog.processors.JSONRenderer(),
    ]
)
