from __future__ import annotations

from datetime import date, time

from sqlalchemy import Date, ForeignKey, String, Text, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from valhalla.db.base import Base, TimestampMixin
from valhalla.models.tasks import Task


class DayPlan(TimestampMixin, Base):
    __tablename__ = "day_plans"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_date: Mapped[date] = mapped_column(Date, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(160), default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    unit_minutes: Mapped[int] = mapped_column(default=25)
    break_minutes: Mapped[int] = mapped_column(default=5)
    starts_at: Mapped[time] = mapped_column(Time, default=time(9, 0))

    slots: Mapped[list[PlanSlot]] = relationship(
        back_populates="plan",
        cascade="all, delete-orphan",
        order_by="PlanSlot.position",
        lazy="selectin",
    )


class PlanSlot(Base):
    __tablename__ = "plan_slots"
    __table_args__ = (UniqueConstraint("plan_id", "position", name="plan_id_position"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("day_plans.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[int | None] = mapped_column(
        ForeignKey("tasks.id", ondelete="CASCADE"), default=None, index=True
    )
    label: Mapped[str] = mapped_column(String(200), default="")
    position: Mapped[int] = mapped_column(default=0)
    units: Mapped[int] = mapped_column(default=1)

    plan: Mapped[DayPlan] = relationship(back_populates="slots")
    task: Mapped[Task | None] = relationship(lazy="selectin")
