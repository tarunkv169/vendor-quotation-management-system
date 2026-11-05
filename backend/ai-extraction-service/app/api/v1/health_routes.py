"""Liveness and readiness probes (no authentication, no sensitive details)."""
from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text

router = APIRouter(prefix="/api/v1/health", tags=["Health"])


@router.get("", summary="Liveness: the process is running")
async def liveness() -> dict[str, str]:
    return {"status": "UP"}


@router.get("/ready", summary="Readiness: database reachable")
async def readiness(request: Request) -> JSONResponse:
    container = request.app.state.container
    checks: dict[str, str] = {}
    try:
        async with container.engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
        checks["database"] = "UP"
    except Exception:
        checks["database"] = "DOWN"
    ready = all(value == "UP" for value in checks.values())
    return JSONResponse(status_code=200 if ready else 503,
                        content={"status": "UP" if ready else "DOWN", "checks": checks})
