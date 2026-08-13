from __future__ import annotations

from datetime import datetime

from pydantic import Field

from valhalla.models.enums import TaskState
from valhalla.schemas.common import ReadModel, WriteModel
from valhalla.schemas.media import MediaRead


class TaskRead(ReadModel):
    id: int
    title: str
    notes: str
    state: TaskState
    position: int
    units: int
    completed_at: datetime | None
    icon_id: int | None
    achievement_id: int | None
    metric_id: int | None
    metric_delta: float
    icon: MediaRead | None
    created_at: datetime


class TaskCreate(WriteModel):
    title: str = Field(min_length=1, max_length=200)
    notes: str = ""
    units: int = Field(default=1, ge=1, le=96)
    icon_id: int | None = None
    achievement_id: int | None = None
    metric_id: int | None = None
    metric_delta: float = 0.0


class TaskUpdate(WriteModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    notes: str | None = None
    state: TaskState | None = None
    units: int | None = Field(default=None, ge=1, le=96)
    icon_id: int | None = None
    achievement_id: int | None = None
    metric_id: int | None = None
    metric_delta: float | None = None
