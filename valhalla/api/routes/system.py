from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import APIRouter, status
from pydantic import BaseModel

from valhalla import __version__
from valhalla.api.deps import DbSession
from valhalla.models import TaskState
from valhalla.schemas.achievements import AchievementRead
from valhalla.schemas.common import WriteModel
from valhalla.schemas.metrics import MetricRead
from valhalla.schemas.planning import PlanRead
from valhalla.schemas.tasks import TaskRead
from valhalla.services import achievements as achievement_service
from valhalla.services import media as media_service
from valhalla.services import metrics as metric_service
from valhalla.services import planning as planning_service
from valhalla.services import preferences as preference_service
from valhalla.services import reminders as reminder_service
from valhalla.services import tasks as task_service
from valhalla.services import vault as vault_service

router = APIRouter(tags=["system"])


class PreferencePatch(WriteModel):
    values: dict[str, Any]


class RestoreRequest(WriteModel):
    name: str


class Overview(BaseModel):
    version: str
    today: date
    achievements: dict[str, int]
    metrics: list[MetricRead]
    open_tasks: list[TaskRead]
    recent_unlocks: list[AchievementRead]
    plan: PlanRead | None
    due_reminders: int


@router.get("/overview", response_model=Overview)
def overview(session: DbSession) -> Overview:
    today = date.today()
    plan = planning_service.get_plan_for_date(session, today)
    unlocked = sorted(
        achievement_service.list_achievements(session, unlocked=True),
        key=lambda item: item.unlocked_at or item.created_at,
        reverse=True,
    )[:5]
    return Overview(
        version=__version__,
        today=today,
        achievements=achievement_service.progress(session),
        metrics=[MetricRead.model_validate(item) for item in metric_service.list_metrics(session)],
        open_tasks=[
            TaskRead.model_validate(item)
            for item in task_service.list_tasks(session, TaskState.OPEN)
        ],
        recent_unlocks=[AchievementRead.model_validate(item) for item in unlocked],
        plan=planning_service.serialize_plan(plan) if plan else None,
        due_reminders=len(reminder_service.due_signals(session)),
    )


@router.get("/preferences")
def read_preferences(session: DbSession) -> dict[str, Any]:
    return preference_service.all_preferences(session)


@router.put("/preferences")
def write_preferences(session: DbSession, payload: PreferencePatch) -> dict[str, Any]:
    return preference_service.set_preferences(session, payload.values)


@router.post("/preferences/reset")
def reset_preferences(session: DbSession, keys: list[str] | None = None) -> dict[str, Any]:
    return preference_service.reset(session, keys)


@router.get("/vault")
def vault_info() -> dict[str, object]:
    return vault_service.vault_summary()


@router.get("/vault/backups")
def list_backups() -> list[dict[str, object]]:
    return vault_service.list_backups()


@router.post("/vault/backups", status_code=status.HTTP_201_CREATED)
def create_backup() -> dict[str, str]:
    return {"name": vault_service.create_backup().name}


@router.post("/vault/backups/restore")
def restore_backup(payload: RestoreRequest) -> dict[str, str]:
    vault_service.restore_backup(payload.name)
    return {"status": "restored"}


@router.delete("/vault/backups/{name}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_backup(name: str) -> None:
    vault_service.delete_backup(name)


@router.post("/vault/presets/sync")
def sync_presets(session: DbSession) -> dict[str, int]:
    return {"discovered": media_service.sync_presets(session)}


@router.post("/vault/scan")
def scan_vault(session: DbSession) -> dict[str, int]:
    return {"discovered": media_service.scan_vault(session)}
