from __future__ import annotations

from datetime import datetime

from pydantic import Field

from valhalla.models.enums import EntityKind, ReminderCadence
from valhalla.schemas.common import ReadModel, WriteModel
from valhalla.schemas.media import MediaRead


class ReminderRead(ReadModel):
    id: int
    title: str
    message: str
    cadence: ReminderCadence
    is_active: bool
    anchor_at: datetime
    next_fire_at: datetime
    last_fired_at: datetime | None
    fire_count: int
    target_kind: EntityKind | None
    target_id: int | None
    sound_id: int | None
    icon_id: int | None
    sound: MediaRead | None
    icon: MediaRead | None


class ReminderCreate(WriteModel):
    title: str = Field(min_length=1, max_length=200)
    message: str = ""
    cadence: ReminderCadence = ReminderCadence.DAILY
    is_active: bool = True
    anchor_at: datetime | None = None
    target_kind: EntityKind | None = None
    target_id: int | None = None
    sound_id: int | None = None
    icon_id: int | None = None


class ReminderUpdate(WriteModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    message: str | None = None
    cadence: ReminderCadence | None = None
    is_active: bool | None = None
    anchor_at: datetime | None = None
    target_kind: EntityKind | None = None
    target_id: int | None = None
    sound_id: int | None = None
    icon_id: int | None = None


class ReminderSignal(ReadModel):
    reminder: ReminderRead
    target_label: str | None = None
    due_at: datetime
