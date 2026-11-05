"""Builds and closes the application's components.

Extraction jobs run inside the API process, so the LLM workflow is built at startup
(only when an LLM is configured).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from app.clients.document_service_client import DocumentServiceClient
from app.config.settings import Settings
from app.database.connection import create_engine, create_session_factory
from app.services.extraction_service import ExtractionService


@dataclass
class Container:
    settings: Settings
    engine: AsyncEngine
    session_factory: async_sessionmaker[AsyncSession]
    document_client: DocumentServiceClient
    extraction_service: ExtractionService

    async def close(self) -> None:
        await self.document_client.close()
        await self.engine.dispose()


def build_container(settings: Settings) -> Container:
    engine = create_engine(settings.database_url.get_secret_value())
    session_factory = create_session_factory(engine)
    document_client = DocumentServiceClient(settings)
    graph: Any = _build_workflow(settings) if settings.llm_enabled else None
    service = ExtractionService(settings, session_factory, document_client, graph)
    return Container(settings, engine, session_factory, document_client, service)


def _build_workflow(settings: Settings) -> Any:
    from app.ai.llm_factory import create_chat_model, create_structured_extractor
    from app.ai.workflows.extraction_graph import build_extraction_graph
    from app.services.confidence_service import ConfidenceService
    from app.services.ocr_service import OcrService

    extractor = create_structured_extractor(create_chat_model(settings), settings.llm_provider)
    return build_extraction_graph(
        settings,
        extractor,
        OcrService(settings),
        ConfidenceService(settings.confidence_high_threshold, settings.confidence_review_threshold),
    )
