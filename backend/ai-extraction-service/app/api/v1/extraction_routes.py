"""Extraction endpoints (thin: validation + auth here, logic in ExtractionService).

Long-running work is never done in the request: POST/retry enqueue a job and return
202 Accepted with a status URL to poll.
"""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Response, status

from app.api.dependencies import CanRead, CanWrite, Service
from app.schemas.extraction_request import ExtractionRequest
from app.schemas.extraction_response import ExtractionAccepted, ExtractionResponse
from app.schemas.quotation_schema import ExtractionStatus

router = APIRouter(prefix="/api/v1/extractions", tags=["Extractions"])


def _accepted(response: Response, extraction_id: uuid.UUID, document_id: uuid.UUID,
              state: str, duplicate: bool) -> ExtractionAccepted:
    status_url = f"/api/v1/extractions/{extraction_id}"
    response.headers["Location"] = status_url
    return ExtractionAccepted(extraction_id=extraction_id, document_id=document_id,
                              status=ExtractionStatus(state), status_url=status_url, duplicate=duplicate)


@router.post("", status_code=status.HTTP_202_ACCEPTED, response_model=ExtractionAccepted,
             summary="Request extraction of a quotation document")
async def create_extraction(body: ExtractionRequest, response: Response,
                            principal: CanWrite, service: Service) -> ExtractionAccepted:
    record, duplicate = await service.request_extraction(body.document_id, principal.user_id, body.force)
    return _accepted(response, record.id, record.document_id, record.status, duplicate)


@router.get("/{extraction_id}", response_model=ExtractionResponse, summary="Get extraction status and result")
async def get_extraction(extraction_id: uuid.UUID, principal: CanRead, service: Service) -> ExtractionResponse:
    return await service.get(extraction_id)


@router.get("/document/{document_id}", response_model=list[ExtractionResponse],
            summary="List extractions of a document (newest first)")
async def list_document_extractions(document_id: uuid.UUID, principal: CanRead,
                                    service: Service) -> list[ExtractionResponse]:
    return await service.list_by_document(document_id)


@router.post("/{extraction_id}/retry", status_code=status.HTTP_202_ACCEPTED, response_model=ExtractionAccepted,
             summary="Retry a failed extraction")
async def retry_extraction(extraction_id: uuid.UUID, response: Response,
                           principal: CanWrite, service: Service) -> ExtractionAccepted:
    record = await service.retry(extraction_id)
    return _accepted(response, record.id, record.document_id, record.status, False)
