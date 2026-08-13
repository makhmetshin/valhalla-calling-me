from __future__ import annotations

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from valhalla.db.base import Base, TimestampMixin


class Preference(TimestampMixin, Base):
    __tablename__ = "preferences"

    key: Mapped[str] = mapped_column(String(120), primary_key=True)
    value: Mapped[dict | list | str | int | float | bool | None] = mapped_column(JSON, default=None)
