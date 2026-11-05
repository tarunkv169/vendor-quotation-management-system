"""Typed application settings loaded from environment variables (and .env for local dev).

`pydantic-settings` validates every value at startup, so a missing secret or a malformed
URL stops the service immediately instead of failing on the first request.
"""
from __future__ import annotations

from decimal import Decimal
from functools import lru_cache
from typing import Literal
from uuid import UUID

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # ---- application ----
    app_name: str = "ai-extraction-service"
    environment: str = "local"
    log_level: str = "INFO"
    api_port: int = 8090

    # ---- security ----
    jwt_secret: SecretStr
    jwt_algorithm: Literal["HS256", "HS384", "HS512"] = "HS512"
    jwt_role_claim: str = "role"
    jwt_user_id_claim: str = "userId"
    service_user_id: UUID = UUID("00000000-0000-0000-0000-00000000a1e0")
    service_token_ttl_seconds: int = Field(default=300, ge=60, le=3600)

    # ---- database ----
    database_url: SecretStr

    # ---- document service ----
    document_service_base_url: str = "http://localhost:8083"
    allowed_download_hosts: list[str] = ["localhost", "127.0.0.1"]
    http_connect_timeout_seconds: float = 3.0
    http_read_timeout_seconds: float = 30.0

    # ---- processing limits ----
    max_file_size_bytes: int = Field(default=20 * 1024 * 1024, ge=1024)
    max_pdf_pages: int = Field(default=50, ge=1)
    max_excel_rows: int = Field(default=5_000, ge=1)
    max_excel_columns: int = Field(default=60, ge=1)
    max_llm_input_chars: int = Field(default=60_000, ge=1_000)
    processing_timeout_seconds: int = Field(default=600, ge=30)

    # ---- OCR ----
    tesseract_cmd: str | None = None
    ocr_languages: str = "eng"
    ocr_dpi: int = Field(default=300, ge=100, le=600)
    ocr_timeout_seconds: int = Field(default=60, ge=5)
    ocr_min_text_chars_per_page: int = Field(default=40, ge=0)

    # ---- LLM ----
    # Feature flag: False = no LLM configured; extraction requests are rejected with 503 and no model
    # client is created. Set LLM_ENABLED=true together with LLM_MODEL and LLM_API_KEY to extract.
    llm_enabled: bool = False
    llm_provider: Literal["openai", "anthropic"] = "openai"
    llm_model: str = ""
    llm_api_key: SecretStr = SecretStr("")
    llm_timeout_seconds: float = Field(default=90, ge=5)
    llm_max_attempts: int = Field(default=2, ge=1, le=5)
    llm_temperature: float | None = 0

    # ---- confidence ----
    confidence_high_threshold: Decimal = Decimal("0.85")
    confidence_review_threshold: Decimal = Decimal("0.60")
    date_day_first: bool = True

    @field_validator("jwt_secret")
    @classmethod
    def _secret_length(cls, value: SecretStr) -> SecretStr:
        if len(value.get_secret_value()) < 32:
            raise ValueError("JWT_SECRET must be at least 32 characters")
        return value

    @model_validator(mode="after")
    def _llm_configured(self) -> "Settings":
        self.llm_model = self.llm_model.strip()
        if self.llm_enabled and not self.llm_model:
            raise ValueError("LLM_MODEL must be set when LLM_ENABLED=true")
        if self.llm_enabled and not self.llm_api_key.get_secret_value():
            raise ValueError("LLM_API_KEY must be set when LLM_ENABLED=true")
        return self

    @field_validator("tesseract_cmd")
    @classmethod
    def _empty_to_none(cls, value: str | None) -> str | None:
        return value or None


@lru_cache
def get_settings() -> Settings:
    """Singleton accessor; `lru_cache` makes every caller share one validated instance."""
    return Settings()  # type: ignore[call-arg]
