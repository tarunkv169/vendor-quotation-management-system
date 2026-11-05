"""Base model for every JSON contract of this service.

Python attributes stay snake_case, while JSON uses camelCase like the Java services
(`alias_generator=to_camel`). `populate_by_name=True` also accepts snake_case input.
FastAPI serializes response models by alias automatically; for messages we call
`model_dump(mode="json", by_alias=True)`. In "json" mode Decimals are written as strings,
so no precision is lost on the way to Java BigDecimal.
"""
from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class ApiModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)
