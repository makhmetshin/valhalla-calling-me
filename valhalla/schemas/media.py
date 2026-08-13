from __future__ import annotations

from datetime import datetime

from pydantic import computed_field

from valhalla.media_paths import public_url
from valhalla.models.enums import MediaKind, MediaOrigin
from valhalla.schemas.common import ReadModel, WriteModel


class MediaRead(ReadModel):
    id: int
    kind: MediaKind
    origin: MediaOrigin
    title: str
    relative_path: str
    mime_type: str
    size_bytes: int
    created_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def url(self) -> str:
        return public_url(self.kind, self.origin, self.relative_path)


class MediaUpdate(WriteModel):
    title: str | None = None
