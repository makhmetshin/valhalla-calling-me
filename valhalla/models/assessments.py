from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from valhalla.db.base import Base, TimestampMixin


class AssessmentAttempt(TimestampMixin, Base):
    __tablename__ = "assessment_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    instrument: Mapped[str] = mapped_column(String(64), index=True)
    score: Mapped[int] = mapped_column(default=0)
    max_score: Mapped[int] = mapped_column(default=0)
    band: Mapped[str] = mapped_column(String(32), default="")
    alarming: Mapped[bool] = mapped_column(default=False)
    note: Mapped[str] = mapped_column(Text, default="")
    taken_at: Mapped[datetime] = mapped_column(index=True)

    answers: Mapped[list[AssessmentAnswer]] = relationship(
        back_populates="attempt",
        cascade="all, delete-orphan",
        lazy="selectin",
        order_by="AssessmentAnswer.id",
    )


class AssessmentAnswer(Base):
    __tablename__ = "assessment_answers"

    id: Mapped[int] = mapped_column(primary_key=True)
    attempt_id: Mapped[int] = mapped_column(
        ForeignKey("assessment_attempts.id", ondelete="CASCADE"), index=True
    )
    question_key: Mapped[str] = mapped_column(String(64))
    value: Mapped[int] = mapped_column(default=0)

    attempt: Mapped[AssessmentAttempt] = relationship(back_populates="answers")
