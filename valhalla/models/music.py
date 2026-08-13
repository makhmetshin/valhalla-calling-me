from __future__ import annotations

from datetime import datetime

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from valhalla.db.base import Base, TimestampMixin
from valhalla.models.media import MediaAsset


class Playlist(TimestampMixin, Base):
    __tablename__ = "playlists"
    __table_args__ = (UniqueConstraint("directory", name="playlist_directory"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(160))
    directory: Mapped[str] = mapped_column(String(200))
    position: Mapped[int] = mapped_column(default=0)
    cover_path: Mapped[str] = mapped_column(String(400), default="")
    icon_id: Mapped[int | None] = mapped_column(
        ForeignKey("media_assets.id", ondelete="SET NULL"), default=None
    )

    icon: Mapped[MediaAsset | None] = relationship(lazy="selectin")
    tracks: Mapped[list[Track]] = relationship(
        back_populates="playlist", cascade="all, delete-orphan", order_by="Track.position"
    )


class Track(TimestampMixin, Base):
    __tablename__ = "tracks"
    __table_args__ = (UniqueConstraint("asset_id", name="track_asset"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(200))
    artist: Mapped[str] = mapped_column(String(160), default="")
    position: Mapped[int] = mapped_column(default=0)
    play_count: Mapped[int] = mapped_column(default=0)
    last_played_at: Mapped[datetime | None] = mapped_column(default=None)
    playlist_id: Mapped[int | None] = mapped_column(
        ForeignKey("playlists.id", ondelete="CASCADE"), default=None, index=True
    )
    asset_id: Mapped[int] = mapped_column(ForeignKey("media_assets.id", ondelete="CASCADE"))

    playlist: Mapped[Playlist | None] = relationship(back_populates="tracks")
    asset: Mapped[MediaAsset] = relationship(lazy="selectin")
