from __future__ import annotations

from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from valhalla.models import DayPlan, PlanSlot, Task
from valhalla.schemas.planning import PlanRead, PlanSlotRead, PlanWrite
from valhalla.schemas.tasks import TaskRead
from valhalla.services.errors import ValidationError
from valhalla.services.repository import require

_ANCHOR = date(2000, 1, 1)


def _shift(start: time, minutes: int) -> time:
    return (datetime.combine(_ANCHOR, start) + timedelta(minutes=minutes)).time()


def list_plans(session: Session, limit: int = 60) -> list[DayPlan]:
    statement = select(DayPlan).order_by(DayPlan.plan_date.desc()).limit(limit)
    return list(session.execute(statement).scalars())


def get_plan_for_date(session: Session, plan_date: date) -> DayPlan | None:
    return session.execute(
        select(DayPlan).where(DayPlan.plan_date == plan_date)
    ).scalar_one_or_none()


def save_plan(session: Session, payload: PlanWrite) -> DayPlan:
    plan = get_plan_for_date(session, payload.plan_date)
    if plan is None:
        plan = DayPlan(plan_date=payload.plan_date)
        session.add(plan)

    plan.title = payload.title
    plan.notes = payload.notes
    plan.unit_minutes = payload.unit_minutes
    plan.break_minutes = payload.break_minutes
    plan.starts_at = payload.starts_at
    plan.slots.clear()
    session.flush()

    for position, slot in enumerate(payload.slots):
        if slot.task_id is None and not slot.label:
            raise ValidationError("A slot needs either a task or a label")
        if slot.task_id is not None:
            require(session, Task, slot.task_id)
        plan.slots.append(
            PlanSlot(
                task_id=slot.task_id,
                label=slot.label,
                position=position,
                units=slot.units,
            )
        )

    session.flush()
    session.refresh(plan)
    return plan


def delete_plan(session: Session, plan_id: int) -> None:
    session.delete(require(session, DayPlan, plan_id))
    session.flush()


def serialize_plan(plan: DayPlan) -> PlanRead:
    cursor = plan.starts_at
    elapsed = 0
    slots: list[PlanSlotRead] = []

    for index, slot in enumerate(sorted(plan.slots, key=lambda item: item.position)):
        if index:
            cursor = _shift(cursor, plan.break_minutes)
            elapsed += plan.break_minutes
        duration = slot.units * plan.unit_minutes
        ends_at = _shift(cursor, duration)
        slots.append(
            PlanSlotRead(
                id=slot.id,
                task_id=slot.task_id,
                label=slot.label or (slot.task.title if slot.task else ""),
                position=slot.position,
                units=slot.units,
                starts_at=cursor,
                ends_at=ends_at,
                task=TaskRead.model_validate(slot.task) if slot.task else None,
            )
        )
        cursor = ends_at
        elapsed += duration

    return PlanRead(
        id=plan.id,
        plan_date=plan.plan_date,
        title=plan.title,
        notes=plan.notes,
        unit_minutes=plan.unit_minutes,
        break_minutes=plan.break_minutes,
        starts_at=plan.starts_at,
        total_minutes=elapsed,
        ends_at=cursor,
        slots=slots,
    )
