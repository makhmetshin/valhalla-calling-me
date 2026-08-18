from __future__ import annotations

from sqlalchemy import Column, ForeignKey, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from valhalla.db.base import Base, TimestampMixin
from valhalla.models.media import MediaAsset

codex_entry_images = Table(
    "codex_entry_images",
    Base.metadata,
    Column("entry_id", ForeignKey("codex_entries.id", ondelete="CASCADE"), primary_key=True),
    Column("media_id", ForeignKey("media_assets.id", ondelete="CASCADE"), primary_key=True),
)


class CodexChapter(TimestampMixin, Base):
    __tablename__ = "codex_chapters"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    summary: Mapped[str] = mapped_column(Text, default="")
    position: Mapped[int] = mapped_column(default=0)
    is_preset: Mapped[bool] = mapped_column(default=False)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("codex_chapters.id", ondelete="CASCADE"), default=None, index=True
    )

    children: Mapped[list[CodexChapter]] = relationship(
        back_populates="parent",
        cascade="all, delete-orphan",
        order_by="CodexChapter.position, CodexChapter.id",
    )
    parent: Mapped[CodexChapter | None] = relationship(
        back_populates="children", remote_side="CodexChapter.id"
    )
    entries: Mapped[list[CodexEntry]] = relationship(
        back_populates="chapter",
        cascade="all, delete-orphan",
        order_by="CodexEntry.position, CodexEntry.id",
    )


class CodexEntry(TimestampMixin, Base):
    __tablename__ = "codex_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    chapter_id: Mapped[int] = mapped_column(
        ForeignKey("codex_chapters.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text, default="")
    position: Mapped[int] = mapped_column(default=0)
    is_preset: Mapped[bool] = mapped_column(default=False)

    chapter: Mapped[CodexChapter] = relationship(back_populates="entries")
    images: Mapped[list[MediaAsset]] = relationship(secondary=codex_entry_images, lazy="selectin")
