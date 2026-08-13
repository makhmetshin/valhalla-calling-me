from __future__ import annotations

from datetime import date

from fastapi import APIRouter, status

from valhalla.api.deps import DbSession
from valhalla.schemas.planning import PlanRead, PlanWrite
from valhalla.services import planning as service
from valhalla.services.errors import NotFoundError

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("", response_model=list[PlanRead])
def list_plans(session: DbSession, limit: int = 60) -> list[PlanRead]:
    return [service.serialize_plan(plan) for plan in service.list_plans(session, limit)]


@router.get("/{plan_date}", response_model=PlanRead)
def get_plan(session: DbSession, plan_date: date) -> PlanRead:
    plan = service.get_plan_for_date(session, plan_date)
    if plan is None:
        raise NotFoundError(f"No plan for {plan_date.isoformat()}")
    return service.serialize_plan(plan)


@router.put("", response_model=PlanRead)
def save_plan(session: DbSession, payload: PlanWrite) -> PlanRead:
    return service.serialize_plan(service.save_plan(session, payload))


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_plan(session: DbSession, plan_id: int) -> None:
    service.delete_plan(session, plan_id)
