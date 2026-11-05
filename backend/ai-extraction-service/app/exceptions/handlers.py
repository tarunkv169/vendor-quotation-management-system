"""Centralized exception handling: every error becomes the shared ErrorResponse JSON."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from http import HTTPStatus

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.config.logging_config import correlation_id_var
from app.exceptions.extraction_exceptions import ExtractionError
from app.schemas.extraction_response import ErrorResponse

log = logging.getLogger(__name__)


def _response(request: Request, status_code: int, message: str,
              validation_errors: dict[str, str] | None = None, headers: dict | None = None) -> JSONResponse:
    body = ErrorResponse(
        timestamp=datetime.now(timezone.utc),
        status=status_code,
        error=HTTPStatus(status_code).phrase,
        message=message,
        path=request.url.path,
        correlation_id=correlation_id_var.get(),
        validation_errors=validation_errors,
    )
    return JSONResponse(status_code=status_code, headers=headers,
                        content=body.model_dump(mode="json", by_alias=True, exclude_none=True))


def register_exception_handlers(app: FastAPI) -> None:

    @app.exception_handler(ExtractionError)
    async def extraction_error(request: Request, exc: ExtractionError) -> JSONResponse:
        if exc.http_status >= 500:
            log.error("Request failed: %s - %s", exc.code, exc.message)
        return _response(request, exc.http_status, exc.message)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, exc: RequestValidationError) -> JSONResponse:
        errors = {".".join(str(p) for p in e["loc"] if p != "body"): e["msg"] for e in exc.errors()}
        return _response(request, 400, "Request validation failed", errors)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, exc: HTTPException) -> JSONResponse:
        return _response(request, exc.status_code, str(exc.detail), headers=getattr(exc, "headers", None))

    @app.exception_handler(Exception)
    async def unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        log.exception("Unexpected error on %s %s", request.method, request.url.path)
        return _response(request, 500, "An unexpected error occurred")
