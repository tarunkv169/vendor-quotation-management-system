"""API response schemas."""
from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import ConfigDict

from app.schemas.base import ApiModel
from app.schemas.quotation_schema import DocumentFormat, ExtractionStatus, MissingField, QuotationExtraction


class LlmUsage(ApiModel):
    provider: str | None = None
    model: str | None = None
    input_tokens: int = 0
    output_tokens: int = 0


class ExtractionAccepted(ApiModel):
    """202 Accepted body: poll `status_url` for the result."""

    extraction_id: UUID
    document_id: UUID
    status: ExtractionStatus
    status_url: str
    duplicate: bool = False


class ExtractionResponse(ApiModel):
    model_config = ConfigDict(**ApiModel.model_config, from_attributes=True)

    extraction_id: UUID
    document_id: UUID
    quotation_id: UUID | None = None
    vendor_id: UUID | None = None
    procurement_request_id: UUID | None = None
    status: ExtractionStatus
    attempt: int
    document_format: DocumentFormat | None = None
    used_ocr: bool = False
    overall_confidence: Decimal | None = None
    requires_human_review: bool = False
    quotation: QuotationExtraction | None = None
    issues: list[MissingField] = []
    failure_code: str | None = None
    failure_reason: str | None = None
    llm_usage: LlmUsage | None = None
    processing_ms: int | None = None
    created_at: datetime
    updated_at: datetime
    completed_at: datetime | None = None


class ErrorResponse(ApiModel):
    """Same shape as the Java services' ApiErrorResponse."""

    timestamp: datetime
    status: int
    error: str
    message: str
    path: str
    correlation_id: str | None = None
    validation_errors: dict[str, str] | None = None
