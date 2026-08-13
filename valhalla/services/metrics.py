from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from valhalla.db.base import now
from valhalla.models import Achievement, Metric, MetricDirection, MetricEntry
from valhalla.schemas.metrics import MetricAdjust, MetricCreate, MetricUpdate
from valhalla.services.errors import ValidationError
from valhalla.services.repository import apply_patch, next_position, require


def list_metrics(session: Session) -> list[Metric]:
    return list(session.execute(select(Metric).order_by(Metric.position, Metric.id)).scalars())


def create_metric(session: Session, payload: MetricCreate) -> Metric:
    metric = Metric(
        **payload.model_dump(),
        position=next_position(session, Metric),
    )
    session.add(metric)
    session.flush()
    if metric.value:
        session.add(
            MetricEntry(
                metric_id=metric.id,
                delta=metric.value,
                value_after=metric.value,
                note="initial",
                recorded_at=now(),
            )
        )
        session.flush()
    return metric


def update_metric(session: Session, metric_id: int, payload: MetricUpdate) -> Metric:
    metric = apply_patch(require(session, Metric, metric_id), payload)
    session.flush()
    return metric


def delete_metric(session: Session, metric_id: int) -> None:
    session.delete(require(session, Metric, metric_id))
    session.flush()


def adjust_metric(
    session: Session, metric_id: int, payload: MetricAdjust
) -> tuple[Metric, list[Achievement]]:
    metric = require(session, Metric, metric_id)
    if payload.delta is None and payload.value is None:
        raise ValidationError("Provide either delta or value")

    previous = metric.value
    metric.value = payload.value if payload.value is not None else previous + (payload.delta or 0.0)
    session.add(
        MetricEntry(
            metric_id=metric.id,
            delta=metric.value - previous,
            value_after=metric.value,
            note=payload.note,
            recorded_at=now(),
        )
    )
    session.flush()
    return metric, evaluate_metric_achievements(session, metric)


def history(session: Session, metric_id: int, limit: int = 60) -> list[MetricEntry]:
    require(session, Metric, metric_id)
    statement = (
        select(MetricEntry)
        .where(MetricEntry.metric_id == metric_id)
        .order_by(MetricEntry.recorded_at.desc(), MetricEntry.id.desc())
        .limit(limit)
    )
    return list(session.execute(statement).scalars())


def threshold_reached(metric: Metric, target: float) -> bool:
    if metric.direction == MetricDirection.DOWN:
        return metric.value <= target
    return metric.value >= target


def evaluate_metric_achievements(session: Session, metric: Metric) -> list[Achievement]:
    statement = select(Achievement).where(
        Achievement.metric_id == metric.id,
        Achievement.unlocked.is_(False),
        Achievement.metric_target.is_not(None),
    )
    unlocked: list[Achievement] = []
    for achievement in session.execute(statement).scalars():
        if threshold_reached(metric, float(achievement.metric_target or 0.0)):
            achievement.unlocked = True
            achievement.unlocked_at = now()
            unlocked.append(achievement)
    if unlocked:
        session.flush()
    return unlocked
