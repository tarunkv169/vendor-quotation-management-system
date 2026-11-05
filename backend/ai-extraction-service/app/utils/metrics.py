"""Prometheus metrics (exposed at /metrics on the API process)."""
from __future__ import annotations

from prometheus_client import Counter, Histogram

EXTRACTIONS_TOTAL = Counter(
    "vqms_extractions_total", "Finished extractions by final status", ["status"])
EXTRACTION_DURATION_SECONDS = Histogram(
    "vqms_extraction_duration_seconds", "End-to-end processing time per extraction",
    buckets=(1, 5, 10, 20, 40, 60, 120, 300, 600))
EXTRACTION_FAILURES_TOTAL = Counter(
    "vqms_extraction_failures_total", "Extraction failures by failure code", ["code"])
EXTRACTION_RETRIES_TOTAL = Counter(
    "vqms_extraction_retries_total", "Message-level retries scheduled", ["code"])
LLM_TOKENS_TOTAL = Counter(
    "vqms_llm_tokens_total", "LLM tokens consumed", ["provider", "model", "direction"])
LLM_CALLS_TOTAL = Counter(
    "vqms_llm_calls_total", "LLM calls by outcome", ["provider", "outcome"])
OCR_PAGES_TOTAL = Counter(
    "vqms_ocr_pages_total", "Pages processed with OCR", ["outcome"])
