"""Queries for extraction records (persistence only, no business rules)."""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models.extraction_record import ExtractionRecord
from app.schemas.quotation_schema import ExtractionStatus


async def get(session: AsyncSession, extraction_id: uuid.UUID) -> ExtractionRecord | None:
    return await session.get(ExtractionRecord, extraction_id)


async def list_by_document(session: AsyncSession, document_id: uuid.UUID) -> list[ExtractionRecord]:
    result = await session.execute(
        select(ExtractionRecord)
        .where(ExtractionRecord.document_id == document_id)
        .order_by(ExtractionRecord.created_at.desc())
        .limit(100))
    return list(result.scalars())


async def find_active(session: AsyncSession, document_id: uuid.UUID, checksum: str) -> ExtractionRecord | None:
    result = await session.execute(
        select(ExtractionRecord).where(
            ExtractionRecord.document_id == document_id,
            ExtractionRecord.document_checksum == checksum,
            ExtractionRecord.status != ExtractionStatus.FAILED.value,
            ExtractionRecord.superseded.is_(False)))
    return result.scalar_one_or_none()


async def claim_for_processing(session: AsyncSession, extraction_id: uuid.UUID,
                               stale_after: timedelta) -> bool:
    """Atomically moves PENDING -> PROCESSING (or re-claims a PROCESSING job whose process died).

    Only one caller can win this UPDATE, so a job is never processed twice.
    """
    now = datetime.now(timezone.utc)
    result = await session.execute(
        update(ExtractionRecord)
        .where(
            ExtractionRecord.id == extraction_id,
            or_(
                ExtractionRecord.status == ExtractionStatus.PENDING.value,
                (ExtractionRecord.status == ExtractionStatus.PROCESSING.value)
                & (ExtractionRecord.started_at < now - stale_after),
            ))
        .values(status=ExtractionStatus.PROCESSING.value, started_at=now, updated_at=now,
                version=ExtractionRecord.version + 1)
        .returning(ExtractionRecord.id)
        .execution_options(synchronize_session=False))
    return result.scalar_one_or_none() is not None
