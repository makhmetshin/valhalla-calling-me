from __future__ import annotations

from datetime import datetime

from pydantic import Field

from valhalla.schemas.common import ReadModel, WriteModel
from valhalla.schemas.media import MediaRead


class TrackRead(ReadModel):
    id: int
    title: str
    artist: str
    position: int
    play_count: int
    last_played_at: datetime | None
    playlist_id: int | None
    asset_id: int
    asset: MediaRead
    created_at: datetime


class TrackCreate(WriteModel):
    playlist_id: int
    asset_id: int
    title: str = ""
    artist: str = ""


class TrackUpdate(WriteModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    artist: str | None = None


class PlaylistRead(ReadModel):
    id: int
    name: str
    directory: str
    position: int
    icon_id: int | None
    icon: MediaRead | None
    cover_url: str | None
    track_count: int
    created_at: datetime


class PlaylistCreate(WriteModel):
    name: str = Field(min_length=1, max_length=160)
    icon_id: int | None = None


class PlaylistUpdate(WriteModel):
    name: str | None = Field(default=None, min_length=1, max_length=160)
    icon_id: int | None = None
