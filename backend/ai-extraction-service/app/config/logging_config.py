"""Structured JSON logging with correlation and request ids.

Ids are stored in `contextvars`, which are local to the current asyncio task / thread,
so concurrent requests and messages never mix their ids. A logging filter copies them
onto every log record.
"""
from __future__ import annotations

import logging
import sys
from contextvars import ContextVar

from pythonjsonlogger.json import JsonFormatter

correlation_id_var: ContextVar[str | None] = ContextVar("correlation_id", default=None)
request_id_var: ContextVar[str | None] = ContextVar("request_id", default=None)


class ContextFilter(logging.Filter):
    """Adds correlation_id / request_id to each record."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = correlation_id_var.get()
        record.request_id = request_id_var.get()
        return True


def configure_logging(level: str, service_name: str) -> None:
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(ContextFilter())
    handler.setFormatter(
        JsonFormatter(
            "%(asctime)s %(levelname)s %(name)s %(message)s %(correlation_id)s %(request_id)s",
            rename_fields={"asctime": "timestamp", "levelname": "level", "name": "logger"},
            static_fields={"service": service_name},
        )
    )
    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level.upper())

    # Keep noisy libraries quiet; never log request bodies of HTTP clients.
    for noisy in ("httpx", "httpcore", "aio_pika", "aiormq", "openai", "anthropic"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
