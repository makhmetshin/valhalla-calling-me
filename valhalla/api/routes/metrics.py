from __future__ import annotations

from fastapi import APIRouter, status
from pydantic import BaseModel

from valhalla.api.deps import DbSession
from valhalla.models import Metric, MetricEntry
from valhalla.schemas.achievements import AchievementRead
from valhalla.schemas.common import OrderUpdate
from valhalla.schemas.metrics import (
    MetricAdjust,
    MetricCreate,
    MetricEntryRead,
    MetricRead,
    MetricUpdate,
)
from valhalla.services import metrics as service
from valhalla.services.repository import apply_order

router = APIRouter(prefix="/metrics", tags=["metrics"])


class MetricAdjustResult(BaseModel):
    metric: MetricRead
    unlocked: list[AchievementRead]


@router.get("", response_model=list[MetricRead])
def list_metrics(session: DbSession) -> list[Metric]:
    return service.list_metrics(session)


@router.post("", response_model=MetricRead, status_code=status.HTTP_201_CREATED)
def create_metric(session: DbSession, payload: MetricCreate) -> Metric:
    return service.create_metric(session, payload)


@router.patch("/{metric_id}", response_model=MetricRead)
def update_metric(session: DbSession, metric_id: int, payload: MetricUpdate) -> Metric:
    return service.update_metric(session, metric_id, payload)


@router.delete("/{metric_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_metric(session: DbSession, metric_id: int) -> None:
    service.delete_metric(session, metric_id)


@router.post("/{metric_id}/adjust", response_model=MetricAdjustResult)
def adjust_metric(session: DbSession, metric_id: int, payload: MetricAdjust) -> MetricAdjustResult:
    metric, unlocked = service.adjust_metric(session, metric_id, payload)
    return MetricAdjustResult(
        metric=MetricRead.model_validate(metric),
        unlocked=[AchievementRead.model_validate(item) for item in unlocked],
    )


@router.get("/{metric_id}/history", response_model=list[MetricEntryRead])
def history(session: DbSession, metric_id: int, limit: int = 60) -> list[MetricEntry]:
    return service.history(session, metric_id, limit)


@router.post("/order", response_model=list[MetricRead])
def reorder(session: DbSession, payload: OrderUpdate) -> list[Metric]:
    apply_order(session, Metric, payload.ids)
    return service.list_metrics(session)
