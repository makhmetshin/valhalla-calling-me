from __future__ import annotations

from datetime import datetime

from pydantic import Field

from valhalla.schemas.common import ReadModel, WriteModel
from valhalla.schemas.media import MediaRead


class CodexEntryRead(ReadModel):
    id: int
    chapter_id: int
    title: str
    body: str
    position: int
    is_preset: bool
    cover_id: int | None
    cover: MediaRead | None
    images: list[MediaRead]
    updated_at: datetime


class CodexEntrySummary(ReadModel):
    id: int
    chapter_id: int
    title: str
    position: int


class CodexChapterRead(ReadModel):
    id: int
    title: str
    summary: str
    position: int
    is_preset: bool
    parent_id: int | None
    icon_id: int | None
    icon: MediaRead | None
    entries: list[CodexEntrySummary]
    children: list[CodexChapterRead]


class CodexChapterCreate(WriteModel):
    title: str = Field(min_length=1, max_length=200)
    summary: str = ""
    parent_id: int | None = None
    icon_id: int | None = None


class CodexChapterUpdate(WriteModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    summary: str | None = None
    parent_id: int | None = None
    icon_id: int | None = None


class CodexEntryCreate(WriteModel):
    chapter_id: int
    title: str = Field(min_length=1, max_length=200)
    body: str = ""
    cover_id: int | None = None
    image_ids: list[int] = Field(default_factory=list)


class CodexEntryUpdate(WriteModel):
    chapter_id: int | None = None
    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = None
    cover_id: int | None = None
    image_ids: list[int] | None = None
