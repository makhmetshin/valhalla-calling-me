from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from valhalla.db.base import Base, TimestampMixin
from valhalla.models.enums import TaskState
from valhalla.models.media import MediaAsset


class Task(TimestampMixin, Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    notes: Mapped[str] = mapped_column(Text, default="")
    state: Mapped[TaskState] = mapped_column(String(16), default=TaskState.OPEN, index=True)
    position: Mapped[int] = mapped_column(default=0)
    units: Mapped[int] = mapped_column(default=1)
    completed_at: Mapped[datetime | None] = mapped_column(default=None)

    icon_id: Mapped[int | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"), default=None
    )
    achievement_id: Mapped[int | None] = mapped_column(
        ForeignKey("achievements.id", ondelete="SET NULL"), default=None, index=True
    )
    metric_id: Mapped[int | None] = mapped_column(
        ForeignKey("metrics.id", ondelete="SET NULL"), default=None, index=True
    )
    metric_delta: Mapped[float] = mapped_column(default=0.0)

    icon: Mapped[MediaAsset | None] = relationship(lazy="selectin")
