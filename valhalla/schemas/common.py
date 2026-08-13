from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ReadModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class WriteModel(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class OrderUpdate(WriteModel):
    ids: list[int]
