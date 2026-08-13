from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from valhalla.db.base import now
from valhalla.models import Achievement, Metric, MetricEntry, Task, TaskState
from valhalla.schemas.tasks import TaskCreate, TaskUpdate
from valhalla.services.metrics import evaluate_metric_achievements
from valhalla.services.repository import apply_patch, next_position, require


def list_tasks(session: Session, state: TaskState | None = None) -> list[Task]:
    statement = select(Task).order_by(Task.position, Task.id)
    if state is not None:
        statement = statement.where(Task.state == state)
    return list(session.execute(statement).scalars())


def create_task(session: Session, payload: TaskCreate) -> Task:
    task = Task(**payload.model_dump(), position=next_position(session, Task))
    session.add(task)
    session.flush()
    return task


def update_task(session: Session, task_id: int, payload: TaskUpdate) -> Task:
    task = require(session, Task, task_id)
    requested_state = payload.state
    apply_patch(task, payload.model_copy(update={"state": None}) if requested_state else payload)
    session.flush()
    if requested_state is not None:
        set_state(session, task_id, requested_state)
    return task


def delete_task(session: Session, task_id: int) -> None:
    session.delete(require(session, Task, task_id))
    session.flush()


def set_state(session: Session, task_id: int, state: TaskState) -> tuple[Task, list[Achievement]]:
    task = require(session, Task, task_id)
    was_done = task.state == TaskState.DONE
    task.state = state
    task.completed_at = now() if state == TaskState.DONE else None
    session.flush()

    if was_done or state != TaskState.DONE:
        return task, []
    return task, _apply_completion_effects(session, task)


def _apply_completion_effects(session: Session, task: Task) -> list[Achievement]:
    unlocked: list[Achievement] = []

    if task.metric_id is not None and task.metric_delta:
        metric = session.get(Metric, task.metric_id)
        if metric is not None:
            metric.value += task.metric_delta
            session.add(
                MetricEntry(
                    metric_id=metric.id,
                    delta=task.metric_delta,
                    value_after=metric.value,
                    note=f"task: {task.title}",
                    recorded_at=now(),
                )
            )
            session.flush()
            unlocked.extend(evaluate_metric_achievements(session, metric))

    if task.achievement_id is not None:
        achievement = session.get(Achievement, task.achievement_id)
        if achievement is not None and not achievement.unlocked and achievement.metric_id is None:
            achievement.unlocked = True
            achievement.unlocked_at = now()
            unlocked.append(achievement)
            session.flush()

    return unlocked
