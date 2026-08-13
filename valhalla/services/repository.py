from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from valhalla.db.base import Base
from valhalla.services.errors import NotFoundError


def require[ModelT: Base](session: Session, model: type[ModelT], entity_id: int) -> ModelT:
    instance = session.get(model, entity_id)
    if instance is None:
        raise NotFoundError(f"{model.__name__} {entity_id} not found")
    return instance


def next_position[ModelT: Base](session: Session, model: type[ModelT], **filters: object) -> int:
    statement = select(func.coalesce(func.max(model.position), -1))  # type: ignore[attr-defined]
    for field, value in filters.items():
        statement = statement.where(getattr(model, field) == value)
    return int(session.execute(statement).scalar_one()) + 1


def apply_order[ModelT: Base](session: Session, model: type[ModelT], ids: list[int]) -> None:
    for position, entity_id in enumerate(ids):
        instance = require(session, model, entity_id)
        instance.position = position  # type: ignore[attr-defined]
    session.flush()


def apply_patch[ModelT: Base](instance: ModelT, payload: object) -> ModelT:
    data = payload.model_dump(exclude_unset=True)  # type: ignore[attr-defined]
    for field, value in data.items():
        setattr(instance, field, value)
    return instance
