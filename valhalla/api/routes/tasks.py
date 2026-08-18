from __future__ import annotations

from fastapi import APIRouter, status
from pydantic import BaseModel

from valhalla.api.deps import DbSession
from valhalla.models import Task, TaskGroup, TaskState
from valhalla.schemas.achievements import AchievementRead
from valhalla.schemas.common import OrderUpdate, WriteModel
from valhalla.schemas.tasks import (
    TaskCreate,
    TaskGroupCreate,
    TaskGroupRead,
    TaskGroupUpdate,
    TaskRead,
    TaskUpdate,
)
from valhalla.services import tasks as service
from valhalla.services.repository import apply_order

router = APIRouter(prefix="/tasks", tags=["tasks"])


class TaskStateChange(WriteModel):
    state: TaskState


class TaskStateResult(BaseModel):
    task: TaskRead
    unlocked: list[AchievementRead]


@router.get("/groups", response_model=list[TaskGroupRead])
def list_groups(session: DbSession) -> list[TaskGroup]:
    return service.list_groups(session)


@router.post("/groups", response_model=TaskGroupRead, status_code=status.HTTP_201_CREATED)
def create_group(session: DbSession, payload: TaskGroupCreate) -> TaskGroup:
    return service.create_group(session, payload)


@router.patch("/groups/{group_id}", response_model=TaskGroupRead)
def update_group(session: DbSession, group_id: int, payload: TaskGroupUpdate) -> TaskGroup:
    return service.update_group(session, group_id, payload)


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_group(session: DbSession, group_id: int) -> None:
    service.delete_group(session, group_id)


@router.post("/groups/order", response_model=list[TaskGroupRead])
def reorder_groups(session: DbSession, payload: OrderUpdate) -> list[TaskGroup]:
    apply_order(session, TaskGroup, payload.ids)
    return service.list_groups(session)


@router.get("", response_model=list[TaskRead])
def list_tasks(
    session: DbSession, state: TaskState | None = None, group_id: int | None = None
) -> list[Task]:
    return service.list_tasks(session, state, group_id)


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
