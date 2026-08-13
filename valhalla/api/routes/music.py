from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile, status

from valhalla.api.deps import DbSession
from valhalla.models import Track
from valhalla.schemas.common import OrderUpdate
from valhalla.schemas.music import TrackCreate, TrackRead, TrackUpdate
from valhalla.services import music as service
from valhalla.services.repository import apply_order

router = APIRouter(prefix="/music", tags=["music"])


@router.get("/tracks", response_model=list[TrackRead])
def list_tracks(session: DbSession) -> list[Track]:
    return service.list_tracks(session)


@router.post("/tracks", response_model=TrackRead, status_code=status.HTTP_201_CREATED)
def create_track(session: DbSession, payload: TrackCreate) -> Track:
    return service.create_track(session, payload)


@router.post("/tracks/upload", response_model=TrackRead, status_code=status.HTTP_201_CREATED)
async def upload_track(
    session: DbSession,
    file: Annotated[UploadFile, File()],
    title: Annotated[str, Form()] = "",
) -> Track:
    payload = await file.read()
    return service.import_upload(session, file.filename or "track", payload, title)


@router.post("/tracks/order", response_model=list[TrackRead])
def reorder_tracks(session: DbSession, payload: OrderUpdate) -> list[Track]:
    apply_order(session, Track, payload.ids)
    return service.list_tracks(session)


@router.patch("/tracks/{track_id}", response_model=TrackRead)
def update_track(session: DbSession, track_id: int, payload: TrackUpdate) -> Track:
    return service.update_track(session, track_id, payload)


@router.delete("/tracks/{track_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_track(session: DbSession, track_id: int, with_file: bool = False) -> None:
    service.delete_track(session, track_id, with_file)


@router.post("/tracks/{track_id}/played", response_model=TrackRead)
def mark_played(session: DbSession, track_id: int) -> Track:
    return service.mark_played(session, track_id)
