"""API request schemas."""
from __future__ import annotations

from uuid import UUID

from pydantic import ConfigDict, Field

from app.schemas.base import ApiModel


class ExtractionRequest(ApiModel):
    """Body of POST /api/v1/extractions."""

    model_config = ConfigDict(**ApiModel.model_config, extra="forbid")

    document_id: UUID = Field(description="Document Service id of an extractable quotation document")
    force: bool = Field(
        default=False,
        description="Create a new extraction even if one already exists for the same document content",
    )
