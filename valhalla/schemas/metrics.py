from __future__ import annotations

from datetime import datetime

from pydantic import Field

from valhalla.models.enums import MetricDirection
from valhalla.schemas.common import ReadModel, WriteModel
from valhalla.schemas.media import MediaRead


class MetricEntryRead(ReadModel):
    id: int
    metric_id: int
    delta: float
    value_after: float
    note: str
    recorded_at: datetime


class MetricRead(ReadModel):
    id: int
    name: str
    description: str
    unit: str
    value: float
    step: float
    direction: MetricDirection
    target: float | None
    position: int
    icon_id: int | None
    icon: MediaRead | None
    created_at: datetime


class MetricCreate(WriteModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = ""
    unit: str = ""
    value: float = 0.0
    step: float = 1.0
    direction: MetricDirection = MetricDirection.UP
    target: float | None = None
    icon_id: int | None = None


class MetricUpdate(WriteModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    unit: str | None = None
    step: float | None = None
    direction: MetricDirection | None = None
    target: float | None = None
    icon_id: int | None = None


class MetricAdjust(WriteModel):
    delta: float | None = None
    value: float | None = None
    note: str = ""
