"""Extraction job lifecycle: create, process, retry, query.

    PENDING ──claim──► PROCESSING ──► COMPLETED | NEEDS_REVIEW
       ▲                   │
       └── retryable error ┤
                           └── permanent error / retries exhausted ──► FAILED ──retry API──► PENDING

The CPU-bound LangGraph workflow runs in a worker thread (`asyncio.to_thread`) with an
overall timeout, so the API event loop stays responsive. Jobs run as in-process background tasks.
"""
from __future__ import annotations

import asyncio
import logging
import time
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.ai.prompts.quotation_extraction_prompt import PROMPT_VERSION
from app.clients.document_service_client import DOWNLOADABLE_STATUSES, DocumentMetadata, DocumentServiceClient
from app.config.logging_config import correlation_id_var
from app.config.settings import Settings
from app.database import extraction_repository as repository
from app.database.models.extraction_record import ExtractionRecord
from app.exceptions.extraction_exceptions import (
    DocumentValidationError,
    ExtractionDisabledError,
    ExtractionError,
    ExtractionNotFoundError,
    InvalidExtractionRequestError,
    InvalidExtractionStateError,
    ProcessingTimeoutError,
)
from app.schemas.extraction_response import ExtractionResponse, LlmUsage
from app.schemas.quotation_schema import DocumentFormat, ExtractionStatus, MissingField, QuotationExtraction
from app.utils.file_validator import validate_downloaded_file
from app.utils.metrics import EXTRACTION_DURATION_SECONDS, EXTRACTION_FAILURES_TOTAL, EXTRACTIONS_TOTAL

log = logging.getLogger(__name__)

FINAL_SUCCESS = {ExtractionStatus.COMPLETED.value, ExtractionStatus.NEEDS_REVIEW.value}


def _now() -> datetime:
    return datetime.now(timezone.utc)


class ExtractionService:
    def __init__(self, settings: Settings, session_factory: async_sessionmaker[AsyncSession],
                 document_client: DocumentServiceClient, graph: Any) -> None:
        self._settings = settings
        self._sessions = session_factory
        self._documents = document_client
        self._graph = graph
        self._local_tasks: set[asyncio.Task] = set()

    # ------------------------------------------------------------------ requests

    async def request_extraction(self, document_id: uuid.UUID, requested_by: uuid.UUID,
                                 force: bool) -> tuple[ExtractionRecord, bool]:
        """Creates (or returns the existing) extraction and enqueues it. Returns (record, duplicate)."""
        if not self._settings.llm_enabled:
            raise ExtractionDisabledError()
        metadata = await self._documents.get_metadata(document_id)
        if not metadata.extractable:
            raise InvalidExtractionRequestError(f"Documents of type {metadata.document_type} are not extractable")
        if metadata.document_status not in DOWNLOADABLE_STATUSES:
            raise InvalidExtractionStateError(f"Document is not available (status {metadata.document_status})")

        try:
            async with self._sessions() as session, session.begin():
                existing = await repository.find_active(session, document_id, metadata.checksum)
                if existing is not None and not force:
                    return existing, True
                if existing is not None:
                    if existing.status not in FINAL_SUCCESS:
                        raise InvalidExtractionStateError("An extraction for this document is already in progress")
                    existing.superseded = True
                    await session.flush()
                record = self._new_record(metadata, requested_by)
                session.add(record)
        except IntegrityError:
            async with self._sessions() as session:
                existing = await repository.find_active(session, document_id, metadata.checksum)
            if existing is None:
                raise
            return existing, True

        await self._enqueue(record)
        return record, False

    async def retry(self, extraction_id: uuid.UUID) -> ExtractionRecord:
        if not self._settings.llm_enabled:
            raise ExtractionDisabledError()
        try:
            async with self._sessions() as session, session.begin():
                record = await self._get_or_404(session, extraction_id)
                if record.status != ExtractionStatus.FAILED.value:
                    raise InvalidExtractionStateError("Only FAILED extractions can be retried")
                record.status = ExtractionStatus.PENDING.value
                record.attempt += 1
                record.failure_code = None
                record.failure_reason = None
                record.completed_at = None
                record.correlation_id = correlation_id_var.get()
        except IntegrityError as exc:
            raise InvalidExtractionStateError("Another active extraction already exists for this document") from exc
        await self._enqueue(record)
        return record

    async def _enqueue(self, record: ExtractionRecord) -> None:
        # Run the job in this process. The task reference is kept so it is not garbage-collected.
        task = asyncio.create_task(self._process_locally(record.id))
        self._local_tasks.add(task)
        task.add_done_callback(self._local_tasks.discard)

    async def _process_locally(self, extraction_id: uuid.UUID) -> None:
        """Background execution of one job. A retryable failure is recorded as FAILED and can be
        retried with POST /extractions/{id}/retry."""
        try:
            await self.process(extraction_id)
        except ExtractionError as exc:
            if exc.retryable:
                await self._mark_failed(extraction_id, exc)
        except Exception:
            log.exception("In-process extraction %s crashed", extraction_id)

    def _new_record(self, metadata: DocumentMetadata, requested_by: uuid.UUID | None) -> ExtractionRecord:
        return ExtractionRecord(
            id=uuid.uuid4(),
            document_id=metadata.id,
            document_checksum=metadata.checksum,
            document_type=metadata.document_type,
            quotation_id=metadata.quotation_id,
            vendor_id=metadata.vendor_id,
            procurement_request_id=metadata.procurement_request_id,
            status=ExtractionStatus.PENDING.value,
            attempt=1,
            superseded=False,
            used_ocr=False,
            requires_human_review=False,
            input_tokens=0,
            output_tokens=0,
            event_published=False,
            requested_by=requested_by,
            correlation_id=correlation_id_var.get(),
        )

    async def process(self, extraction_id: uuid.UUID) -> None:
        stale_after = timedelta(seconds=self._settings.processing_timeout_seconds * 2)
        async with self._sessions() as session, session.begin():
            claimed = await repository.claim_for_processing(session, extraction_id, stale_after)
            record = await self._get_or_404(session, extraction_id)
        if not claimed:
            log.info("Extraction %s is %s; nothing to do", extraction_id, record.status)
            return

        log.info("Processing extraction %s for document %s (attempt %s)",
                 extraction_id, record.document_id, record.attempt)
        await self._documents.update_status(record.document_id, "PROCESSING")
        started = time.monotonic()
        try:
            state = await self._run_pipeline(record)
        except ExtractionError as exc:
            if exc.retryable:
                await self._release_for_retry(extraction_id, exc)
            else:
                await self._mark_failed(extraction_id, exc)
            raise
        except Exception as exc:
            log.exception("Unexpected failure in extraction %s", extraction_id)
            failure = ExtractionError("Unexpected processing error")
            await self._mark_failed(extraction_id, failure)
            raise failure from exc

        elapsed_ms = int((time.monotonic() - started) * 1000)
        record = await self._store_result(extraction_id, state, elapsed_ms)
        EXTRACTIONS_TOTAL.labels(status=record.status).inc()
        EXTRACTION_DURATION_SECONDS.observe(elapsed_ms / 1000)
        await self._documents.update_status(record.document_id, "PROCESSED",
                                            f"Extraction {record.id} finished: {record.status}")

    async def _run_pipeline(self, record: ExtractionRecord) -> dict[str, Any]:
        metadata = await self._documents.get_metadata(record.document_id)
        if metadata.checksum != record.document_checksum:
            raise DocumentValidationError("Document content changed after the extraction was requested")
        data = await self._documents.download(record.document_id)
        validate_downloaded_file(data, metadata.file_size, metadata.checksum, self._settings.max_file_size_bytes)
        try:
            return await asyncio.wait_for(
                asyncio.to_thread(self._graph.invoke,
                                  {"document_bytes": data, "declared_content_type": metadata.content_type}),
                timeout=self._settings.processing_timeout_seconds)
        except asyncio.TimeoutError as exc:
            raise ProcessingTimeoutError("Document processing timed out") from exc

    async def _store_result(self, extraction_id: uuid.UUID, state: dict[str, Any], elapsed_ms: int) -> ExtractionRecord:
        quotation: QuotationExtraction = state["quotation"]
        issues: list[MissingField] = state.get("issues", [])
        usage = state.get("llm_usage") or {}
        async with self._sessions() as session, session.begin():
            record = await self._get_or_404(session, extraction_id)
            record.status = state["status"].value
            record.document_format = state["document_format"].value
            record.used_ocr = bool(state.get("used_ocr"))
            record.overall_confidence = state.get("overall_confidence")
            record.requires_human_review = bool(state.get("requires_human_review"))
            record.result = quotation.model_dump(mode="json", by_alias=True)
            record.issues = [issue.model_dump(mode="json", by_alias=True) for issue in issues]
            record.failure_code = None
            record.failure_reason = None
            record.llm_provider = self._settings.llm_provider
            record.llm_model = self._settings.llm_model
            record.prompt_version = PROMPT_VERSION
            record.input_tokens = int(usage.get("input_tokens", 0))
            record.output_tokens = int(usage.get("output_tokens", 0))
            record.processing_ms = elapsed_ms
            record.completed_at = _now()
        log.info("Extraction %s finished with status %s (confidence %s, review=%s)",
                 extraction_id, record.status, record.overall_confidence, record.requires_human_review)
        return record

    async def _release_for_retry(self, extraction_id: uuid.UUID, exc: ExtractionError) -> None:
        async with self._sessions() as session, session.begin():
            record = await self._get_or_404(session, extraction_id)
            record.status = ExtractionStatus.PENDING.value
            record.failure_code = exc.code
            record.failure_reason = exc.message[:2000]

    async def _mark_failed(self, extraction_id: uuid.UUID, exc: ExtractionError) -> None:
        async with self._sessions() as session, session.begin():
            record = await self._get_or_404(session, extraction_id)
            record.status = ExtractionStatus.FAILED.value
            record.failure_code = exc.code
            record.failure_reason = exc.message[:2000]
            record.completed_at = _now()
        EXTRACTIONS_TOTAL.labels(status=ExtractionStatus.FAILED.value).inc()
        EXTRACTION_FAILURES_TOTAL.labels(code=exc.code).inc()
        log.error("Extraction %s failed: %s - %s", extraction_id, exc.code, exc.message)
        await self._documents.update_status(record.document_id, "FAILED", f"{exc.code}: {exc.message}")

    # ------------------------------------------------------------------ queries

    async def get(self, extraction_id: uuid.UUID) -> ExtractionResponse:
        async with self._sessions() as session:
            return self.to_response(await self._get_or_404(session, extraction_id))

    async def list_by_document(self, document_id: uuid.UUID) -> list[ExtractionResponse]:
        async with self._sessions() as session:
            return [self.to_response(r) for r in await repository.list_by_document(session, document_id)]

    @staticmethod
    async def _get_or_404(session: AsyncSession, extraction_id: uuid.UUID) -> ExtractionRecord:
        record = await repository.get(session, extraction_id)
        if record is None:
            raise ExtractionNotFoundError(f"Extraction {extraction_id} not found")
        return record

    @staticmethod
    def to_response(record: ExtractionRecord) -> ExtractionResponse:
        return ExtractionResponse(
            extraction_id=record.id,
            document_id=record.document_id,
            quotation_id=record.quotation_id,
            vendor_id=record.vendor_id,
            procurement_request_id=record.procurement_request_id,
            status=ExtractionStatus(record.status),
            attempt=record.attempt,
            document_format=DocumentFormat(record.document_format) if record.document_format else None,
            used_ocr=record.used_ocr,
            overall_confidence=record.overall_confidence,
            requires_human_review=record.requires_human_review,
            quotation=QuotationExtraction.model_validate(record.result) if record.result else None,
            issues=[MissingField.model_validate(i) for i in (record.issues or [])],
            failure_code=record.failure_code,
            failure_reason=record.failure_reason,
            llm_usage=LlmUsage(provider=record.llm_provider, model=record.llm_model,
                               input_tokens=record.input_tokens, output_tokens=record.output_tokens)
            if record.llm_provider else None,
            processing_ms=record.processing_ms,
            created_at=record.created_at,
            updated_at=record.updated_at,
            completed_at=record.completed_at,
        )
