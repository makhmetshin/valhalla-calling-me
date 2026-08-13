from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, File, Form, UploadFile, status

from valhalla.api.deps import DbSession
from valhalla.models import Playlist, Track
from valhalla.schemas.common import OrderUpdate
from valhalla.schemas.music import (
    PlaylistCreate,
    PlaylistRead,
    PlaylistUpdate,
    TrackCreate,
    TrackRead,
    TrackUpdate,
)
from valhalla.services import music as service
from valhalla.services.repository import apply_order

router = APIRouter(prefix="/music", tags=["music"])


@router.get("/playlists", response_model=list[PlaylistRead])
def list_playlists(session: DbSession) -> list[PlaylistRead]:
    return [service.serialize_playlist(session, item) for item in service.list_playlists(session)]


@router.post("/playlists", response_model=PlaylistRead, status_code=status.HTTP_201_CREATED)
def create_playlist(session: DbSession, payload: PlaylistCreate) -> PlaylistRead:
    return service.serialize_playlist(session, service.create_playlist(session, payload))


@router.post("/playlists/order", response_model=list[PlaylistRead])
def reorder_playlists(session: DbSession, payload: OrderUpdate) -> list[PlaylistRead]:
    apply_order(session, Playlist, payload.ids)
    return [service.serialize_playlist(session, item) for item in service.list_playlists(session)]


@router.patch("/playlists/{playlist_id}", response_model=PlaylistRead)
def update_playlist(session: DbSession, playlist_id: int, payload: PlaylistUpdate) -> PlaylistRead:
    return service.serialize_playlist(
        session, service.update_playlist(session, playlist_id, payload)
    )


@router.delete(
    "/playlists/{playlist_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None
)
def delete_playlist(session: DbSession, playlist_id: int, with_files: bool = False) -> None:
    service.delete_playlist(session, playlist_id, with_files)


@router.get("/tracks", response_model=list[TrackRead])
def list_tracks(session: DbSession, playlist_id: int | None = None) -> list[Track]:
    return service.list_tracks(session, playlist_id)


@router.post("/tracks", response_model=TrackRead, status_code=status.HTTP_201_CREATED)
def create_track(session: DbSession, payload: TrackCreate) -> Track:
    return service.create_track(session, payload)


@router.post("/tracks/upload", response_model=TrackRead, status_code=status.HTTP_201_CREATED)
async def upload_track(
    session: DbSession,
    file: Annotated[UploadFile, File()],
    playlist_id: Annotated[int, Form()],
    title: Annotated[str, Form()] = "",
) -> Track:
    payload = await file.read()
    return service.import_upload(session, playlist_id, file.filename or "track", payload, title)


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
