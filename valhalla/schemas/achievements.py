from __future__ import annotations

from datetime import datetime

from pydantic import Field

from valhalla.schemas.common import ReadModel, WriteModel
from valhalla.schemas.media import MediaRead
from valhalla.schemas.metrics import MetricRead


class AchievementRead(ReadModel):
    id: int
    title: str
    description: str
    lore: str
    position: int
    unlocked: bool
    unlocked_at: datetime | None
    group_id: int | None
    icon_id: int | None
    sound_id: int | None
    metric_id: int | None
    metric_target: float | None
    icon: MediaRead | None
    sound: MediaRead | None
    metric: MetricRead | None
    created_at: datetime


class AchievementCreate(WriteModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = ""
    lore: str = ""
    group_id: int | None = None
    icon_id: int | None = None
    sound_id: int | None = None
    metric_id: int | None = None
    metric_target: float | None = None


class AchievementUpdate(WriteModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    lore: str | None = None
    group_id: int | None = None
    icon_id: int | None = None
    sound_id: int | None = None
    metric_id: int | None = None
    metric_target: float | None = None


class AchievementGroupRead(ReadModel):
    id: int
    name: str
    description: str
    position: int
    icon_id: int | None
    icon: MediaRead | None


class AchievementGroupCreate(WriteModel):
    name: str = Field(min_length=1, max_length=160)
    description: str = ""
    icon_id: int | None = None


class AchievementGroupUpdate(WriteModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = None
    icon_id: int | None = None
