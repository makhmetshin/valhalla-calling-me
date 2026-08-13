from __future__ import annotations

from sqlalchemy import Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from valhalla.db.base import Base, TimestampMixin
from valhalla.models.enums import MediaKind, MediaOrigin


class MediaAsset(TimestampMixin, Base):
    __tablename__ = "media_assets"
    __table_args__ = (
        UniqueConstraint("origin", "relative_path", name="origin_relative_path"),
        Index("ix_media_assets_kind_origin", "kind", "origin"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[MediaKind] = mapped_column(String(16))
    origin: Mapped[MediaOrigin] = mapped_column(String(16), default=MediaOrigin.UPLOAD)
    title: Mapped[str] = mapped_column(String(160))
    relative_path: Mapped[str] = mapped_column(String(400))
    mime_type: Mapped[str] = mapped_column(String(120), default="application/octet-stream")
    size_bytes: Mapped[int] = mapped_column(default=0)
    checksum: Mapped[str | None] = mapped_column(String(64), default=None, index=True)
