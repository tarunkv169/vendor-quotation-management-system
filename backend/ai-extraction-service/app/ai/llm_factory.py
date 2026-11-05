"""Creates the configured chat model and the structured-output runnable.

Providers are imported lazily, so only the configured provider's package must be importable.
API keys come from settings (environment), never from code. Each client has a request
timeout and a small bounded number of SDK-level retries for rate limits and 5xx errors.
"""
from __future__ import annotations

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.runnables import Runnable

from app.config.settings import Settings
from app.schemas.llm_output import LlmQuotation


def create_chat_model(settings: Settings) -> BaseChatModel:
    common: dict = {
        "model": settings.llm_model,
        "api_key": settings.llm_api_key.get_secret_value(),
        "timeout": settings.llm_timeout_seconds,
        "max_retries": 2,
    }
    if settings.llm_temperature is not None:
        common["temperature"] = settings.llm_temperature

    if settings.llm_provider == "openai":
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(**common)
    if settings.llm_provider == "anthropic":
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(max_tokens=8192, **common)
    raise ValueError(f"Unsupported LLM provider: {settings.llm_provider}")


def create_structured_extractor(model: BaseChatModel, provider: str) -> Runnable:
    """Returns a runnable producing {"raw": AIMessage, "parsed": LlmQuotation | None, "parsing_error": ...}.

    `include_raw=True` keeps the raw message so token usage can be recorded, and turns
    schema-parsing failures into data instead of exceptions (the workflow then retries).
    """
    if provider == "openai":
        return model.with_structured_output(LlmQuotation, method="function_calling", include_raw=True)
    return model.with_structured_output(LlmQuotation, include_raw=True)
