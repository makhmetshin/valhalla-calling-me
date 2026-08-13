from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from valhalla.db.base import Base, TimestampMixin
from valhalla.models.enums import EntityKind, ReminderCadence
from valhalla.models.media import MediaAsset


class Reminder(TimestampMixin, Base):
    __tablename__ = "reminders"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    message: Mapped[str] = mapped_column(Text, default="")
    cadence: Mapped[ReminderCadence] = mapped_column(String(32), default=ReminderCadence.DAILY)
    is_active: Mapped[bool] = mapped_column(default=True, index=True)
    anchor_at: Mapped[datetime]
    next_fire_at: Mapped[datetime] = mapped_column(index=True)
    last_fired_at: Mapped[datetime | None] = mapped_column(default=None)
    fire_count: Mapped[int] = mapped_column(default=0)

    target_kind: Mapped[EntityKind | None] = mapped_column(String(32), default=None)
    target_id: Mapped[int | None] = mapped_column(default=None)

    sound_id: Mapped[int | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"), default=None
    )
    icon_id: Mapped[int | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"), default=None
    )

    sound: Mapped[MediaAsset | None] = relationship(foreign_keys=[sound_id], lazy="selectin")
    icon: Mapped[MediaAsset | None] = relationship(foreign_keys=[icon_id], lazy="selectin")
