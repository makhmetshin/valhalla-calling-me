from __future__ import annotations

import math
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from valhalla.db.base import now
from valhalla.models import CADENCE_SECONDS, Reminder, ReminderCadence
from valhalla.schemas.reminders import (
    ReminderCreate,
    ReminderRead,
    ReminderSignal,
    ReminderUpdate,
)
from valhalla.services.links import resolve
from valhalla.services.repository import require


def compute_next_fire(anchor: datetime, cadence: ReminderCadence, reference: datetime) -> datetime:
    if cadence == ReminderCadence.ONCE:
        return anchor
    interval = timedelta(seconds=CADENCE_SECONDS[cadence])
    if reference < anchor:
        return anchor
    elapsed = (reference - anchor).total_seconds()
    steps = math.floor(elapsed / interval.total_seconds()) + 1
    return anchor + interval * steps


def list_reminders(session: Session) -> list[Reminder]:
    statement = select(Reminder).order_by(Reminder.is_active.desc(), Reminder.next_fire_at)
    return list(session.execute(statement).scalars())


def create_reminder(session: Session, payload: ReminderCreate) -> Reminder:
    data = payload.model_dump()
    anchor = data.pop("anchor_at") or now()
    reminder = Reminder(
        **data,
        anchor_at=anchor,
        next_fire_at=compute_next_fire(anchor, payload.cadence, now()),
    )
    session.add(reminder)
    session.flush()
    return reminder


def update_reminder(session: Session, reminder_id: int, payload: ReminderUpdate) -> Reminder:
    reminder = require(session, Reminder, reminder_id)
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        if field == "anchor_at" and value is None:
            continue
        setattr(reminder, field, value)
    if {"anchor_at", "cadence", "is_active"} & data.keys():
        reminder.next_fire_at = compute_next_fire(reminder.anchor_at, reminder.cadence, now())
    session.flush()
    return reminder


def delete_reminder(session: Session, reminder_id: int) -> None:
    session.delete(require(session, Reminder, reminder_id))
    session.flush()


def due_signals(session: Session, reference: datetime | None = None) -> list[ReminderSignal]:
    moment = reference or now()
    statement = (
        select(Reminder)
        .where(Reminder.is_active.is_(True), Reminder.next_fire_at <= moment)
        .order_by(Reminder.next_fire_at)
    )
    signals: list[ReminderSignal] = []
    for reminder in session.execute(statement).scalars():
        target = (
            resolve(session, reminder.target_kind, reminder.target_id)
            if reminder.target_kind is not None and reminder.target_id is not None
            else None
        )
        signals.append(
            ReminderSignal(
                reminder=ReminderRead.model_validate(reminder),
                target_label=target.label if target else None,
                due_at=reminder.next_fire_at,
            )
        )
    return signals


def acknowledge(session: Session, reminder_id: int) -> Reminder:
    reminder = require(session, Reminder, reminder_id)
    moment = now()
    reminder.last_fired_at = moment
    reminder.fire_count += 1
    if reminder.cadence == ReminderCadence.ONCE:
        reminder.is_active = False
    else:
        reminder.next_fire_at = compute_next_fire(reminder.anchor_at, reminder.cadence, moment)
    session.flush()
    return reminder


def snooze(session: Session, reminder_id: int, minutes: int) -> Reminder:
    reminder = require(session, Reminder, reminder_id)
    reminder.next_fire_at = now() + timedelta(minutes=max(1, minutes))
    session.flush()
    return reminder
