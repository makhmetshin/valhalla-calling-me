from __future__ import annotations

from fastapi import APIRouter

from valhalla.api.deps import DbSession
from valhalla.config import get_settings
from valhalla.schemas.export import ExportResult
from valhalla.services import export as service

router = APIRouter(prefix="/export", tags=["export"])


def _result(files: list) -> ExportResult:
    return ExportResult(directory=get_settings().exports_dir.as_posix(), files=files)


@router.post("/codex", response_model=ExportResult)
def export_codex(session: DbSession, language: str = "ru") -> ExportResult:
    return _result([service.export_codex(session, language)])


@router.post("/tablets", response_model=ExportResult)
def export_tablets(session: DbSession, language: str = "ru") -> ExportResult:
    return _result(service.export_tablets(session, language))
