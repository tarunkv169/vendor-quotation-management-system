"""FastAPI dependencies: JWT authentication, role checks and service access.

`Depends(...)` lets FastAPI run these functions before the route handler and inject
their return values. Identity always comes from the verified token, never from the body.
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.config.settings import Settings, get_settings
from app.services.extraction_service import ExtractionService

ADMINISTRATORS = {"ADMIN", "PROCUREMENT_ADMIN"}
REVIEWERS = {"PROCUREMENT_MANAGER", "EMPLOYEE"}
INTERNAL_SERVICE = "INTERNAL_SERVICE"

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    user_id: uuid.UUID
    username: str | None
    role: str


def _normalize_role(raw: object) -> str | None:
    if not isinstance(raw, str) or not raw.strip():
        return None
    role = raw.strip().upper()
    return role[5:] if role.startswith("ROLE_") else role


def get_principal(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Principal:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication is required or the token is invalid",
                                 headers={"WWW-Authenticate": "Bearer"})
    if credentials is None:
        raise unauthorized
    try:
        claims = jwt.decode(
            credentials.credentials,
            settings.jwt_secret.get_secret_value(),
            algorithms=[settings.jwt_algorithm],  # pin the algorithm: never trust the token header
            options={"require": ["exp"]},
        )
        user_id = uuid.UUID(str(claims[settings.jwt_user_id_claim]))
    except (jwt.PyJWTError, KeyError, ValueError):
        raise unauthorized from None
    role = _normalize_role(claims.get(settings.jwt_role_claim))
    if role is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Token has no role")
    return Principal(user_id=user_id, username=claims.get("sub"), role=role)


def require_roles(*roles: str):
    """Dependency factory: `Depends(require_roles("ADMIN", ...))`."""
    allowed = set(roles)

    def checker(principal: Annotated[Principal, Depends(get_principal)]) -> Principal:
        if principal.role not in allowed:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "You do not have permission to perform this action")
        return principal

    return checker


CanRead = Annotated[Principal, Depends(require_roles(*ADMINISTRATORS, *REVIEWERS, INTERNAL_SERVICE))]
CanWrite = Annotated[Principal, Depends(require_roles(*ADMINISTRATORS, INTERNAL_SERVICE))]


def get_extraction_service(request: Request) -> ExtractionService:
    return request.app.state.container.extraction_service


Service = Annotated[ExtractionService, Depends(get_extraction_service)]
