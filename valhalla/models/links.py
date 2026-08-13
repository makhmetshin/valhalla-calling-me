from __future__ import annotations

from sqlalchemy import Index, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from valhalla.db.base import Base, TimestampMixin
from valhalla.models.enums import EntityKind


class EntityLink(TimestampMixin, Base):
    __tablename__ = "entity_links"
    __table_args__ = (
        UniqueConstraint(
            "source_kind", "source_id", "target_kind", "target_id", name="link_endpoints"
        ),
        Index("ix_entity_links_target", "target_kind", "target_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    source_kind: Mapped[EntityKind] = mapped_column(String(32), index=True)
    source_id: Mapped[int] = mapped_column(index=True)
    target_kind: Mapped[EntityKind] = mapped_column(String(32))
    target_id: Mapped[int]
    note: Mapped[str] = mapped_column(Text, default="")
