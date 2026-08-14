from __future__ import annotations

from valhalla.schemas.common import ReadModel


class ExportedFile(ReadModel):
    name: str
    path: str
    size_bytes: int


class ExportResult(ReadModel):
    directory: str
    files: list[ExportedFile]
