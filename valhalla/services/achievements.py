from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from valhalla.db.base import now
from valhalla.models import Achievement, AchievementGroup
from valhalla.schemas.achievements import (
    AchievementCreate,
    AchievementGroupCreate,
    AchievementGroupUpdate,
    AchievementUpdate,
)
from valhalla.services.errors import ConflictError
from valhalla.services.repository import apply_patch, next_position, require


def list_groups(session: Session) -> list[AchievementGroup]:
    return list(
        session.execute(
            select(AchievementGroup).order_by(AchievementGroup.position, AchievementGroup.id)
        ).scalars()
    )


def create_group(session: Session, payload: AchievementGroupCreate) -> AchievementGroup:
    exists = session.execute(
        select(AchievementGroup).where(AchievementGroup.name == payload.name)
    ).scalar_one_or_none()
    if exists is not None:
        raise ConflictError("A group with this name already exists")
    group = AchievementGroup(
        **payload.model_dump(), position=next_position(session, AchievementGroup)
    )
    session.add(group)
    session.flush()
    return group


def update_group(
    session: Session, group_id: int, payload: AchievementGroupUpdate
) -> AchievementGroup:
    group = apply_patch(require(session, AchievementGroup, group_id), payload)
    session.flush()
    return group


def delete_group(session: Session, group_id: int) -> None:
    session.delete(require(session, AchievementGroup, group_id))
    session.flush()


def list_achievements(
    session: Session, group_id: int | None = None, unlocked: bool | None = None
) -> list[Achievement]:
    statement = select(Achievement).order_by(Achievement.position, Achievement.id)
    if group_id is not None:
        statement = statement.where(Achievement.group_id == group_id)
    if unlocked is not None:
        statement = statement.where(Achievement.unlocked.is_(unlocked))
    return list(session.execute(statement).scalars())


def create_achievement(session: Session, payload: AchievementCreate) -> Achievement:
    data = payload.model_dump()
    achievement = Achievement(
        **data, position=next_position(session, Achievement, group_id=data.get("group_id"))
    )
    session.add(achievement)
    session.flush()
    return achievement


def update_achievement(
    session: Session, achievement_id: int, payload: AchievementUpdate
) -> Achievement:
    achievement = apply_patch(require(session, Achievement, achievement_id), payload)
    session.flush()
    return achievement


def delete_achievement(session: Session, achievement_id: int) -> None:
    session.delete(require(session, Achievement, achievement_id))
    session.flush()


def set_unlocked(session: Session, achievement_id: int, unlocked: bool) -> Achievement:
    achievement = require(session, Achievement, achievement_id)
    achievement.unlocked = unlocked
    achievement.unlocked_at = now() if unlocked else None
    session.flush()
    return achievement


def progress(session: Session) -> dict[str, int]:
    total = len(list_achievements(session))
    unlocked = len(list_achievements(session, unlocked=True))
    return {"total": total, "unlocked": unlocked, "locked": total - unlocked}
