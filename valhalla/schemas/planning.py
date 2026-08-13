from __future__ import annotations

from datetime import date, time

from pydantic import Field

from valhalla.schemas.common import ReadModel, WriteModel
from valhalla.schemas.tasks import TaskRead


class PlanSlotRead(ReadModel):
    id: int
    task_id: int | None
    label: str
    position: int
    units: int
    starts_at: time
    ends_at: time
    task: TaskRead | None = None


class PlanRead(ReadModel):
    id: int
    plan_date: date
    title: str
    notes: str
    unit_minutes: int
    break_minutes: int
    starts_at: time
    total_minutes: int
    ends_at: time
    slots: list[PlanSlotRead]


class PlanSlotWrite(WriteModel):
    task_id: int | None = None
    label: str = ""
    units: int = Field(default=1, ge=1, le=96)


class PlanWrite(WriteModel):
    plan_date: date
    title: str = ""
    notes: str = ""
    unit_minutes: int = Field(default=25, ge=1, le=480)
    break_minutes: int = Field(default=5, ge=0, le=240)
    starts_at: time = time(9, 0)
    slots: list[PlanSlotWrite] = Field(default_factory=list)
