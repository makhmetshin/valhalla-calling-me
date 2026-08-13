from __future__ import annotations

from fastapi import APIRouter, status
from pydantic import BaseModel

from valhalla.api.deps import DbSession
from valhalla.models import Task, TaskState
from valhalla.schemas.achievements import AchievementRead
from valhalla.schemas.common import OrderUpdate, WriteModel
from valhalla.schemas.tasks import TaskCreate, TaskRead, TaskUpdate
from valhalla.services import tasks as service
from valhalla.services.repository import apply_order

router = APIRouter(prefix="/tasks", tags=["tasks"])


class TaskStateChange(WriteModel):
    state: TaskState


class TaskStateResult(BaseModel):
    task: TaskRead
    unlocked: list[AchievementRead]


@router.get("", response_model=list[TaskRead])
def list_tasks(session: DbSession, state: TaskState | None = None) -> list[Task]:
    return service.list_tasks(session, state)


@router.post("", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
def create_task(session: DbSession, payload: TaskCreate) -> Task:
    return service.create_task(session, payload)


@router.patch("/{task_id}", response_model=TaskRead)
def update_task(session: DbSession, task_id: int, payload: TaskUpdate) -> Task:
    return service.update_task(session, task_id, payload)


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_task(session: DbSession, task_id: int) -> None:
    service.delete_task(session, task_id)


@router.post("/{task_id}/state", response_model=TaskStateResult)
def set_state(session: DbSession, task_id: int, payload: TaskStateChange) -> TaskStateResult:
    task, unlocked = service.set_state(session, task_id, payload.state)
    return TaskStateResult(
        task=TaskRead.model_validate(task),
        unlocked=[AchievementRead.model_validate(item) for item in unlocked],
    )


@router.post("/order", response_model=list[TaskRead])
def reorder(session: DbSession, payload: OrderUpdate) -> list[Task]:
    apply_order(session, Task, payload.ids)
    return service.list_tasks(session)
