from __future__ import annotations

from fastapi import APIRouter, status

from valhalla.api.deps import DbSession
from valhalla.models import Achievement, AchievementGroup
from valhalla.schemas.achievements import (
    AchievementCreate,
    AchievementGroupCreate,
    AchievementGroupRead,
    AchievementGroupUpdate,
    AchievementRead,
    AchievementUpdate,
)
from valhalla.schemas.common import OrderUpdate
from valhalla.services import achievements as service
from valhalla.services.repository import apply_order

router = APIRouter(prefix="/achievements", tags=["achievements"])


@router.get("/groups", response_model=list[AchievementGroupRead])
def list_groups(session: DbSession) -> list[AchievementGroup]:
    return service.list_groups(session)


@router.post("/groups", response_model=AchievementGroupRead, status_code=status.HTTP_201_CREATED)
def create_group(session: DbSession, payload: AchievementGroupCreate) -> AchievementGroup:
    return service.create_group(session, payload)


@router.patch("/groups/{group_id}", response_model=AchievementGroupRead)
def update_group(
    session: DbSession, group_id: int, payload: AchievementGroupUpdate
) -> AchievementGroup:
    return service.update_group(session, group_id, payload)


@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_group(session: DbSession, group_id: int) -> None:
    service.delete_group(session, group_id)


@router.post("/groups/order", response_model=list[AchievementGroupRead])
def reorder_groups(session: DbSession, payload: OrderUpdate) -> list[AchievementGroup]:
    apply_order(session, AchievementGroup, payload.ids)
    return service.list_groups(session)


@router.get("", response_model=list[AchievementRead])
def list_achievements(
    session: DbSession, group_id: int | None = None, unlocked: bool | None = None
) -> list[Achievement]:
    return service.list_achievements(session, group_id, unlocked)


@router.get("/progress")
def progress(session: DbSession) -> dict[str, int]:
    return service.progress(session)


@router.post("", response_model=AchievementRead, status_code=status.HTTP_201_CREATED)
def create_achievement(session: DbSession, payload: AchievementCreate) -> Achievement:
    return service.create_achievement(session, payload)


@router.patch("/{achievement_id}", response_model=AchievementRead)
def update_achievement(
    session: DbSession, achievement_id: int, payload: AchievementUpdate
) -> Achievement:
    return service.update_achievement(session, achievement_id, payload)


@router.delete("/{achievement_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_achievement(session: DbSession, achievement_id: int) -> None:
    service.delete_achievement(session, achievement_id)


@router.post("/{achievement_id}/unlock", response_model=AchievementRead)
def unlock(session: DbSession, achievement_id: int) -> Achievement:
    return service.set_unlocked(session, achievement_id, True)


@router.post("/{achievement_id}/lock", response_model=AchievementRead)
def lock(session: DbSession, achievement_id: int) -> Achievement:
    return service.set_unlocked(session, achievement_id, False)


@router.post("/order", response_model=list[AchievementRead])
def reorder(session: DbSession, payload: OrderUpdate) -> list[Achievement]:
    apply_order(session, Achievement, payload.ids)
    return service.list_achievements(session)
