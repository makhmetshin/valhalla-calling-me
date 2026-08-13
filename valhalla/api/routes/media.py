from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile, status

from valhalla.api.deps import DbSession
from valhalla.models import MediaKind
from valhalla.schemas.media import MediaRead, MediaUpdate
from valhalla.services import media as media_service

router = APIRouter(prefix="/media", tags=["media"])


@router.get("", response_model=list[MediaRead])
def list_media(session: DbSession, kind: MediaKind | None = None) -> list[MediaRead]:
    return [MediaRead.model_validate(asset) for asset in media_service.list_assets(session, kind)]


@router.post("", response_model=MediaRead, status_code=status.HTTP_201_CREATED)
async def upload_media(
    session: DbSession,
    file: Annotated[UploadFile, File()],
    title: Annotated[str, Form()] = "",
) -> MediaRead:
    payload = await file.read()
    asset = media_service.store_upload(session, file.filename or "asset", payload, title)
    return MediaRead.model_validate(asset)


@router.patch("/{asset_id}", response_model=MediaRead)
def rename_media(session: DbSession, asset_id: int, payload: MediaUpdate) -> MediaRead:
    asset = media_service.rename_asset(session, asset_id, payload.title or "")
    return MediaRead.model_validate(asset)


@router.delete("/{asset_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_media(session: DbSession, asset_id: int) -> None:
    media_service.delete_asset(session, asset_id)
