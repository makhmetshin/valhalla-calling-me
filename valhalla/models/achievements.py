from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from valhalla.db.base import Base, TimestampMixin
from valhalla.models.media import MediaAsset
from valhalla.models.metrics import Metric


class AchievementGroup(TimestampMixin, Base):
    __tablename__ = "achievement_groups"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160), unique=True)
    description: Mapped[str] = mapped_column(Text, default="")
    position: Mapped[int] = mapped_column(default=0)
    icon_id: Mapped[int | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"), default=None
    )

    icon: Mapped[MediaAsset | None] = relationship(lazy="selectin")
    achievements: Mapped[list[Achievement]] = relationship(
        back_populates="group", order_by="Achievement.position"
    )


class Achievement(TimestampMixin, Base):
    __tablename__ = "achievements"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    lore: Mapped[str] = mapped_column(Text, default="")
    position: Mapped[int] = mapped_column(default=0)
    unlocked: Mapped[bool] = mapped_column(default=False)
    unlocked_at: Mapped[datetime | None] = mapped_column(default=None)

    group_id: Mapped[int | None] = mapped_column(
        ForeignKey("achievement_groups.id", ondelete="SET NULL"), default=None, index=True
    )
    icon_id: Mapped[int | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"), default=None
    )
    sound_id: Mapped[int | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"), default=None
    )
    metric_id: Mapped[int | None] = mapped_column(
        ForeignKey("metrics.id", ondelete="SET NULL"), default=None, index=True
    )
    metric_target: Mapped[float | None] = mapped_column(default=None)

    group: Mapped[AchievementGroup | None] = relationship(back_populates="achievements")
    icon: Mapped[MediaAsset | None] = relationship(foreign_keys=[icon_id], lazy="selectin")
    sound: Mapped[MediaAsset | None] = relationship(foreign_keys=[sound_id], lazy="selectin")
    metric: Mapped[Metric | None] = relationship(lazy="selectin")
