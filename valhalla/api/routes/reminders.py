from __future__ import annotations

from fastapi import APIRouter, status

from valhalla.api.deps import DbSession
from valhalla.models import Reminder
from valhalla.schemas.common import WriteModel
from valhalla.schemas.reminders import (
    ReminderCreate,
    ReminderRead,
    ReminderSignal,
    ReminderUpdate,
)
from valhalla.services import reminders as service

router = APIRouter(prefix="/reminders", tags=["reminders"])


class SnoozeRequest(WriteModel):
    minutes: int = 15


@router.get("", response_model=list[ReminderRead])
def list_reminders(session: DbSession) -> list[Reminder]:
    return service.list_reminders(session)


@router.get("/due", response_model=list[ReminderSignal])
def due(session: DbSession) -> list[ReminderSignal]:
    return service.due_signals(session)


@router.post("", response_model=ReminderRead, status_code=status.HTTP_201_CREATED)
def create_reminder(session: DbSession, payload: ReminderCreate) -> Reminder:
    return service.create_reminder(session, payload)


@router.patch("/{reminder_id}", response_model=ReminderRead)
def update_reminder(session: DbSession, reminder_id: int, payload: ReminderUpdate) -> Reminder:
    return service.update_reminder(session, reminder_id, payload)


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_reminder(session: DbSession, reminder_id: int) -> None:
    service.delete_reminder(session, reminder_id)


@router.post("/{reminder_id}/acknowledge", response_model=ReminderRead)
def acknowledge(session: DbSession, reminder_id: int) -> Reminder:
    return service.acknowledge(session, reminder_id)


@router.post("/{reminder_id}/snooze", response_model=ReminderRead)
def snooze(session: DbSession, reminder_id: int, payload: SnoozeRequest) -> Reminder:
    return service.snooze(session, reminder_id, payload.minutes)
