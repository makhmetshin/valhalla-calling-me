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
    asset_id: int
    asset: MediaRead
    created_at: datetime


class TrackCreate(WriteModel):
    asset_id: int
    title: str = ""
    artist: str = ""


class TrackUpdate(WriteModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    artist: str | None = None
