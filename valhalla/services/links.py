from __future__ import annotations

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from valhalla.db.base import Base
from valhalla.models import (
    Achievement,
    AchievementGroup,
    CodexChapter,
    CodexEntry,
    DayPlan,
    EntityKind,
    EntityLink,
    Metric,
    Reminder,
    TabletKind,
    TabletPage,
    Task,
    TaskGroup,
    Track,
)
from valhalla.schemas.links import EntityRef, LinkCreate, LinkRead
from valhalla.services.errors import ConflictError, NotFoundError
from valhalla.services.repository import require

ENTITY_MODELS: dict[EntityKind, type[Base]] = {
    EntityKind.ACHIEVEMENT: Achievement,
    EntityKind.ACHIEVEMENT_GROUP: AchievementGroup,
    EntityKind.METRIC: Metric,
    EntityKind.TASK: Task,
    EntityKind.TASK_GROUP: TaskGroup,
    EntityKind.DAY_PLAN: DayPlan,
    EntityKind.REMINDER: Reminder,
    EntityKind.CODEX_CHAPTER: CodexChapter,
    EntityKind.CODEX_ENTRY: CodexEntry,
    EntityKind.TABLET_KIND: TabletKind,
    EntityKind.TABLET_PAGE: TabletPage,
    EntityKind.TRACK: Track,
}


def _describe(kind: EntityKind, instance: Base) -> EntityRef:
    match kind:
        case EntityKind.ACHIEVEMENT:
            assert isinstance(instance, Achievement)
            detail = "unlocked" if instance.unlocked else "locked"
            return EntityRef(kind=kind, id=instance.id, label=instance.title, detail=detail)
        case EntityKind.ACHIEVEMENT_GROUP:
            assert isinstance(instance, AchievementGroup)
            return EntityRef(kind=kind, id=instance.id, label=instance.name)
        case EntityKind.METRIC:
            assert isinstance(instance, Metric)
            detail = f"{instance.value:g} {instance.unit}".strip()
            return EntityRef(kind=kind, id=instance.id, label=instance.name, detail=detail)
        case EntityKind.TASK:
            assert isinstance(instance, Task)
            return EntityRef(
                kind=kind, id=instance.id, label=instance.title, detail=str(instance.state)
            )
        case EntityKind.TASK_GROUP:
            assert isinstance(instance, TaskGroup)
            return EntityRef(kind=kind, id=instance.id, label=instance.name)
        case EntityKind.DAY_PLAN:
            assert isinstance(instance, DayPlan)
            label = instance.title or instance.plan_date.isoformat()
            return EntityRef(kind=kind, id=instance.id, label=label)
        case EntityKind.REMINDER:
            assert isinstance(instance, Reminder)
            return EntityRef(kind=kind, id=instance.id, label=instance.title)
        case EntityKind.CODEX_CHAPTER:
            assert isinstance(instance, CodexChapter)
            return EntityRef(kind=kind, id=instance.id, label=instance.title)
        case EntityKind.CODEX_ENTRY:
            assert isinstance(instance, CodexEntry)
            return EntityRef(kind=kind, id=instance.id, label=instance.title)
        case EntityKind.TABLET_KIND:
            assert isinstance(instance, TabletKind)
            detail = f"{len(instance.columns)} columns"
            return EntityRef(kind=kind, id=instance.id, label=instance.title, detail=detail)
        case EntityKind.TABLET_PAGE:
            assert isinstance(instance, TabletPage)
            return EntityRef(
                kind=kind, id=instance.id, label=instance.title, detail=instance.kind.title
            )
        case EntityKind.TRACK:
            assert isinstance(instance, Track)
            return EntityRef(
                kind=kind, id=instance.id, label=instance.title, detail=instance.artist
            )
    raise NotFoundError(f"Unknown entity kind: {kind}")


def resolve(session: Session, kind: EntityKind, entity_id: int) -> EntityRef | None:
    model = ENTITY_MODELS.get(kind)
    if model is None:
        return None
    instance = session.get(model, entity_id)
    if instance is None:
        return None
    return _describe(kind, instance)


def catalog(session: Session) -> dict[str, list[EntityRef]]:
    result: dict[str, list[EntityRef]] = {}
    for kind, model in ENTITY_MODELS.items():
        instances = session.execute(select(model)).scalars()
        result[str(kind)] = [_describe(kind, instance) for instance in instances]
    return result


def _serialize(session: Session, link: EntityLink) -> LinkRead:
    return LinkRead(
        id=link.id,
        source_kind=link.source_kind,
        source_id=link.source_id,
        target_kind=link.target_kind,
        target_id=link.target_id,
        note=link.note,
        source=resolve(session, link.source_kind, link.source_id),
        target=resolve(session, link.target_kind, link.target_id),
    )


def list_links(
    session: Session, kind: EntityKind | None = None, entity_id: int | None = None
) -> list[LinkRead]:
    statement = select(EntityLink).order_by(EntityLink.id)
    if kind is not None and entity_id is not None:
        statement = statement.where(
            or_(
                (EntityLink.source_kind == kind) & (EntityLink.source_id == entity_id),
                (EntityLink.target_kind == kind) & (EntityLink.target_id == entity_id),
            )
        )
    return [_serialize(session, link) for link in session.execute(statement).scalars()]


def create_link(session: Session, payload: LinkCreate) -> LinkRead:
    if payload.source_kind == payload.target_kind and payload.source_id == payload.target_id:
        raise ConflictError("An entity cannot be linked to itself")
    for kind, entity_id in (
        (payload.source_kind, payload.source_id),
        (payload.target_kind, payload.target_id),
    ):
        if resolve(session, kind, entity_id) is None:
            raise NotFoundError(f"{kind} {entity_id} not found")

    existing = session.execute(
        select(EntityLink).where(
            EntityLink.source_kind == payload.source_kind,
            EntityLink.source_id == payload.source_id,
            EntityLink.target_kind == payload.target_kind,
            EntityLink.target_id == payload.target_id,
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise ConflictError("This link already exists")

    link = EntityLink(**payload.model_dump())
    session.add(link)
    session.flush()
    return _serialize(session, link)


def delete_link(session: Session, link_id: int) -> None:
    session.delete(require(session, EntityLink, link_id))
    session.flush()
