from __future__ import annotations

from valhalla.models.enums import EntityKind
from valhalla.schemas.common import ReadModel, WriteModel


class EntityRef(ReadModel):
    kind: EntityKind
    id: int
    label: str
    detail: str = ""


class LinkRead(ReadModel):
    id: int
    source_kind: EntityKind
    source_id: int
    target_kind: EntityKind
    target_id: int
    note: str
    target: EntityRef | None = None
    source: EntityRef | None = None


class LinkCreate(WriteModel):
    source_kind: EntityKind
    source_id: int
    target_kind: EntityKind
    target_id: int
    note: str = ""
