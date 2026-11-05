"""Client for the Java Document Service.

Authentication: a short-lived JWT with role INTERNAL_SERVICE, signed with the shared
Identity secret (the current VQMS contract is a shared HMAC key). Replace with OAuth2
client-credentials from the Identity Service when it supports them.

Downloads: the Document Service returns a presigned S3 URL. Before fetching it we check the
scheme and host against an allow-list (SSRF protection), never forward our bearer token
to S3, and stream with a hard size limit.
"""
from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass
from urllib.parse import urlparse

import httpx
import jwt

from app.config.logging_config import correlation_id_var
from app.config.settings import Settings
from app.exceptions.extraction_exceptions import (
    DocumentAccessError,
    DocumentRetrievalError,
    DocumentValidationError,
)

log = logging.getLogger(__name__)

EXTRACTABLE_TYPES = {"QUOTATION_PDF", "QUOTATION_EXCEL"}
DOWNLOADABLE_STATUSES = {"ACTIVE", "PROCESSING", "PROCESSED", "FAILED"}


@dataclass(frozen=True)
class DocumentMetadata:
    id: uuid.UUID
    document_type: str
    document_status: str
    content_type: str
    file_size: int
    checksum: str
    quotation_id: uuid.UUID | None
    vendor_id: uuid.UUID | None
    procurement_request_id: uuid.UUID | None

    @property
    def extractable(self) -> bool:
        return self.document_type in EXTRACTABLE_TYPES


def _uuid_or_none(value: str | None) -> uuid.UUID | None:
    return uuid.UUID(value) if value else None


class ServiceTokenProvider:
    """Mints and caches the service's own JWT until shortly before expiry."""

    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._token: str | None = None
        self._expires_at = 0.0

    def token(self) -> str:
        now = time.time()
        if self._token is None or now > self._expires_at - 30:
            ttl = self._settings.service_token_ttl_seconds
            claims = {
                "sub": self._settings.app_name,
                self._settings.jwt_role_claim: "INTERNAL_SERVICE",
                self._settings.jwt_user_id_claim: str(self._settings.service_user_id),
                "iat": int(now),
                "exp": int(now) + ttl,
            }
            self._token = jwt.encode(claims, self._settings.jwt_secret.get_secret_value(),
                                     algorithm=self._settings.jwt_algorithm)
            self._expires_at = now + ttl
        return self._token


class DocumentServiceClient:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._tokens = ServiceTokenProvider(settings)
        timeout = httpx.Timeout(settings.http_read_timeout_seconds, connect=settings.http_connect_timeout_seconds)
        self._api = httpx.AsyncClient(base_url=settings.document_service_base_url, timeout=timeout)
        # Separate client without auth headers or cookies for presigned URLs.
        self._storage = httpx.AsyncClient(timeout=timeout, follow_redirects=False)

    async def close(self) -> None:
        await self._api.aclose()
        await self._storage.aclose()

    def _headers(self) -> dict[str, str]:
        headers = {"Authorization": f"Bearer {self._tokens.token()}"}
        correlation_id = correlation_id_var.get()
        if correlation_id:
            headers["X-Correlation-Id"] = correlation_id
        return headers

    async def _get_json(self, path: str) -> dict:
        try:
            response = await self._api.get(path, headers=self._headers())
        except httpx.HTTPError as exc:
            raise DocumentRetrievalError("Document Service is unreachable") from exc
        if response.status_code in (401, 403):
            raise DocumentAccessError("Document Service denied access to the document")
        if response.status_code == 404:
            raise DocumentAccessError("Document not found")
        if response.status_code == 409:
            raise DocumentAccessError("Document is not available in its current status")
        if response.status_code >= 500:
            raise DocumentRetrievalError(f"Document Service error {response.status_code}")
        if response.status_code != 200:
            raise DocumentAccessError(f"Unexpected Document Service response {response.status_code}")
        return response.json()

    async def get_metadata(self, document_id: uuid.UUID) -> DocumentMetadata:
        body = await self._get_json(f"/api/v1/documents/{document_id}")
        return DocumentMetadata(
            id=uuid.UUID(body["id"]),
            document_type=body["documentType"],
            document_status=body["documentStatus"],
            content_type=body["contentType"],
            file_size=int(body["fileSize"]),
            checksum=body["checksum"],
            quotation_id=_uuid_or_none(body.get("quotationId")),
            vendor_id=_uuid_or_none(body.get("vendorId")),
            procurement_request_id=_uuid_or_none(body.get("procurementRequestId")),
        )

    async def download(self, document_id: uuid.UUID) -> bytes:
        body = await self._get_json(f"/api/v1/documents/{document_id}/download")
        url = body.get("downloadUrl") or ""
        self._assert_allowed_url(url)

        limit = self._settings.max_file_size_bytes
        chunks: list[bytes] = []
        received = 0
        try:
            async with self._storage.stream("GET", url) as response:
                if response.status_code != 200:
                    raise DocumentRetrievalError(f"Storage returned {response.status_code}")
                async for chunk in response.aiter_bytes():
                    received += len(chunk)
                    if received > limit:
                        raise DocumentValidationError("Document exceeds the processing size limit")
                    chunks.append(chunk)
        except httpx.HTTPError as exc:
            raise DocumentRetrievalError("Document storage is unreachable") from exc
        return b"".join(chunks)

    def _assert_allowed_url(self, url: str) -> None:
        parsed = urlparse(url)
        host = (parsed.hostname or "").lower()
        allowed = {h.lower() for h in self._settings.allowed_download_hosts}
        host_ok = host in allowed or any(host.endswith("." + h) for h in allowed)
        if parsed.scheme not in ("https", "http") or not host_ok:
            raise DocumentAccessError("Download URL host is not allowed")
        if parsed.scheme == "http" and host not in ("localhost", "127.0.0.1") and self._settings.environment != "local":
            raise DocumentAccessError("Insecure download URL rejected")

    async def update_status(self, document_id: uuid.UUID, status: str, reason: str | None = None) -> None:
        """Best effort: a failed status update never fails the extraction."""
        try:
            response = await self._api.patch(
                f"/api/v1/documents/{document_id}/status",
                json={"status": status, "reason": (reason or "")[:1000] or None},
                headers=self._headers())
            if response.status_code >= 400:
                log.warning("Document status update to %s returned %s", status, response.status_code)
        except httpx.HTTPError:
            log.warning("Document status update to %s failed", status, exc_info=True)
