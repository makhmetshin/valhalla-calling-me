from __future__ import annotations

from datetime import datetime

from pydantic import Field

from valhalla.schemas.common import ReadModel, WriteModel
from valhalla.schemas.media import MediaRead

MAX_COLUMNS = 12


class TabletColumnRead(ReadModel):
    id: int
    title: str
    position: int


class TabletColumnWrite(WriteModel):
    id: int | None = None
    title: str = Field(min_length=1, max_length=120)


class TabletPageSummary(ReadModel):
    id: int
    kind_id: int
    title: str
    purpose: str
    position: int
    updated_at: datetime


class TabletKindRead(ReadModel):
    id: int
    title: str
    summary: str
    position: int
    icon_id: int | None
    icon: MediaRead | None
    columns: list[TabletColumnRead]
    page_count: int


class TabletKindCreate(WriteModel):
    title: str = Field(min_length=1, max_length=200)
    summary: str = ""
    icon_id: int | None = None
    columns: list[TabletColumnWrite] = Field(min_length=1, max_length=MAX_COLUMNS)


class TabletKindUpdate(WriteModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    summary: str | None = None
    icon_id: int | None = None
    columns: list[TabletColumnWrite] | None = Field(default=None, max_length=MAX_COLUMNS)


class TabletRowRead(ReadModel):
    id: int
    position: int
    cells: dict[int, str]


class TabletRowWrite(WriteModel):
    id: int | None = None
    cells: dict[int, str] = Field(default_factory=dict)


class TabletPageRead(ReadModel):
    id: int
    kind_id: int
    title: str
    purpose: str
    position: int
    updated_at: datetime
    rows: list[TabletRowRead]


class TabletPageCreate(WriteModel):
    kind_id: int
    title: str = Field(min_length=1, max_length=200)
    purpose: str = ""


class TabletPageUpdate(WriteModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    purpose: str | None = None
    rows: list[TabletRowWrite] | None = None
