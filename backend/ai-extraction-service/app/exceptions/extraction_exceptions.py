"""Domain exceptions.

Each exception carries:
- `code`        stable machine-readable failure code (stored and published in events)
- `http_status` status used when raised inside an API request
- `retryable`   True for transient problems (network, timeouts, rate limits). The message
                consumer re-schedules retryable failures with a delay; non-retryable ones
                fail the extraction immediately.
"""
from __future__ import annotations


class ExtractionError(Exception):
    code = "EXTRACTION_ERROR"
    http_status = 500
    retryable = False

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


class ExtractionDisabledError(ExtractionError):
    code = "EXTRACTION_DISABLED"
    http_status = 503

    def __init__(self) -> None:
        super().__init__("AI extraction is disabled (LLM_ENABLED=false). Configure an LLM to extract documents.")


class ExtractionNotFoundError(ExtractionError):
    code = "EXTRACTION_NOT_FOUND"
    http_status = 404


class InvalidExtractionRequestError(ExtractionError):
    code = "INVALID_REQUEST"
    http_status = 400


class InvalidExtractionStateError(ExtractionError):
    code = "INVALID_STATE"
    http_status = 409


class DocumentAccessError(ExtractionError):
    """Document Service refused access (403) or the document does not exist (404)."""

    code = "DOCUMENT_ACCESS_DENIED"
    http_status = 422


class DocumentRetrievalError(ExtractionError):
    """Document Service or storage temporarily unavailable."""

    code = "DOCUMENT_RETRIEVAL_FAILED"
    http_status = 503
    retryable = True


class DocumentValidationError(ExtractionError):
    """File failed size, checksum, type or safety checks."""

    code = "DOCUMENT_INVALID"
    http_status = 422


class UnsupportedDocumentError(ExtractionError):
    code = "DOCUMENT_UNSUPPORTED"
    http_status = 422


class OcrError(ExtractionError):
    code = "OCR_FAILED"
    http_status = 500


class LlmExtractionError(ExtractionError):
    """LLM call failed (timeout, rate limit, provider outage)."""

    code = "LLM_UNAVAILABLE"
    http_status = 503
    retryable = True


class LlmOutputError(ExtractionError):
    """LLM kept returning output that does not satisfy the schema."""

    code = "LLM_INVALID_OUTPUT"
    http_status = 500


class ProcessingTimeoutError(ExtractionError):
    code = "PROCESSING_TIMEOUT"
    http_status = 504
    retryable = True
