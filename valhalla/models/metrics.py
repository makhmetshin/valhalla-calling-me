from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from valhalla.db.base import Base, TimestampMixin
from valhalla.models.enums import MetricDirection
from valhalla.models.media import MediaAsset


class Metric(TimestampMixin, Base):
    __tablename__ = "metrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, default="")
    unit: Mapped[str] = mapped_column(String(32), default="")
    value: Mapped[float] = mapped_column(default=0.0)
    step: Mapped[float] = mapped_column(default=1.0)
    direction: Mapped[MetricDirection] = mapped_column(String(8), default=MetricDirection.UP)
    target: Mapped[float | None] = mapped_column(default=None)
    position: Mapped[int] = mapped_column(default=0)
    icon_id: Mapped[int | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"), default=None
    )

    icon: Mapped[MediaAsset | None] = relationship(lazy="selectin")
    entries: Mapped[list[MetricEntry]] = relationship(
        back_populates="metric",
        cascade="all, delete-orphan",
        order_by="MetricEntry.recorded_at.desc()",
    )


class MetricEntry(Base):
    __tablename__ = "metric_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    metric_id: Mapped[int] = mapped_column(ForeignKey("metrics.id", ondelete="CASCADE"), index=True)
    delta: Mapped[float] = mapped_column(default=0.0)
    value_after: Mapped[float] = mapped_column(default=0.0)
    note: Mapped[str] = mapped_column(Text, default="")
    recorded_at: Mapped[datetime]

    metric: Mapped[Metric] = relationship(back_populates="entries")
