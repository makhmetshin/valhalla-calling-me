from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from valhalla.db.base import Base, TimestampMixin
from valhalla.models.media import MediaAsset


class Track(TimestampMixin, Base):
    __tablename__ = "tracks"
    __table_args__ = (UniqueConstraint("asset_id", name="track_asset"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    artist: Mapped[str] = mapped_column(String(160), default="")
    position: Mapped[int] = mapped_column(default=0)
    play_count: Mapped[int] = mapped_column(default=0)
    last_played_at: Mapped[datetime | None] = mapped_column(default=None)
    asset_id: Mapped[int] = mapped_column(ForeignKey("media_assets.id", ondelete="CASCADE"))

    asset: Mapped[MediaAsset] = relationship(lazy="selectin")
