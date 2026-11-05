"""Extraction history table.

One row per extraction job. The partial unique index guarantees at most one *active*
(not failed, not superseded) extraction per document content, which makes duplicate
requests and redelivered messages idempotent.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from sqlalchemy import Boolean, DateTime, Index, Integer, Numeric, String, Text, Uuid, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database.connection import Base


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class ExtractionRecord(Base):
    __tablename__ = "extraction_records"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    document_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    document_checksum: Mapped[str] = mapped_column(String(64), nullable=False)
    document_type: Mapped[str | None] = mapped_column(String(50))
    quotation_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, index=True)
    vendor_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    procurement_request_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)

    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    attempt: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    superseded: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    document_format: Mapped[str | None] = mapped_column(String(20))
    used_ocr: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    overall_confidence: Mapped[Decimal | None] = mapped_column(Numeric(4, 3))
    requires_human_review: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    result: Mapped[dict[str, Any] | None] = mapped_column(JSONB)
    issues: Mapped[list[dict[str, Any]] | None] = mapped_column(JSONB)

    failure_code: Mapped[str | None] = mapped_column(String(50))
    failure_reason: Mapped[str | None] = mapped_column(Text)

    correlation_id: Mapped[str | None] = mapped_column(String(64))
    requested_by: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    llm_provider: Mapped[str | None] = mapped_column(String(30))
    llm_model: Mapped[str | None] = mapped_column(String(100))
    prompt_version: Mapped[str | None] = mapped_column(String(50))
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    processing_ms: Mapped[int | None] = mapped_column(Integer)

    # True once ExtractionCompletedEvent was confirmed by the broker (re-sent on redelivery otherwise).
    event_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Python-side defaults so values are available on the object right after commit
    # (async sessions cannot lazy-load server-generated columns).
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utc_now, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_utc_now, onupdate=_utc_now, server_default=func.now())
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    __table_args__ = (
        Index(
            "uq_extraction_active_document",
            "document_id",
            "document_checksum",
            unique=True,
            postgresql_where=text("status <> 'FAILED' AND superseded = false"),
        ),
    )
    # Optimistic locking: UPDATEs include "WHERE version = :old" and increment it.
    __mapper_args__ = {"version_id_col": version}
