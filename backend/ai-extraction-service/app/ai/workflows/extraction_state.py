"""LangGraph state shared by all workflow nodes.

`TypedDict(total=False)`: each node returns only the keys it changes and LangGraph merges
them into the state. Keys are documented in the order the pipeline fills them.
"""
from __future__ import annotations

from decimal import Decimal
from typing import Any, TypedDict

from app.schemas.llm_output import LlmQuotation
from app.schemas.quotation_schema import DocumentFormat, ExtractionStatus, MissingField, QuotationExtraction


class PageText(TypedDict):
    page: int
    label: str          # "Page" or "Sheet <name>"
    text: str
    tables: list[list[list[str]]]
    from_ocr: bool


class ExtractionState(TypedDict, total=False):
    # input
    document_bytes: bytes
    declared_content_type: str
    # classification / text extraction
    document_format: DocumentFormat
    pages: list[PageText]
    ocr_page_numbers: list[int]
    used_ocr: bool
    ocr_mean_confidence: Decimal | None
    # normalization
    source_text: str
    source_truncated: bool
    # LLM
    llm_attempts: int
    llm_output: LlmQuotation | None
    llm_error: str | None
    llm_usage: dict[str, Any]
    # results
    quotation: QuotationExtraction | None
    issues: list[MissingField]
    overall_confidence: Decimal
    requires_human_review: bool
    status: ExtractionStatus
