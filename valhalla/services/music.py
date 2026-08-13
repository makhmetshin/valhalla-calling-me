from __future__ import annotations

from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from valhalla.db.base import now
from valhalla.models import MediaAsset, MediaKind, Track
from valhalla.schemas.music import TrackCreate, TrackUpdate
from valhalla.services import media as media_service
from valhalla.services.errors import ConflictError, ValidationError
from valhalla.services.repository import apply_patch, next_position, require


def _split_name(source: str) -> tuple[str, str]:
    if " - " in source:
        artist, _, title = source.partition(" - ")
        return title.strip(), artist.strip()
    return source.strip(), ""


def _track_for_asset(session: Session, asset_id: int) -> Track | None:
    return session.execute(select(Track).where(Track.asset_id == asset_id)).scalar_one_or_none()


def list_tracks(session: Session) -> list[Track]:
    return list(session.execute(select(Track).order_by(Track.position, Track.id)).scalars())


def create_track(session: Session, payload: TrackCreate) -> Track:
    asset = require(session, MediaAsset, payload.asset_id)
    if asset.kind != MediaKind.AUDIO:
        raise ValidationError("Only audio files can be added to the playlist")
    if _track_for_asset(session, asset.id) is not None:
        raise ConflictError("This file is already in the playlist")

    title, artist = _split_name(payload.title or asset.title)
    track = Track(
        title=title or asset.title,
        artist=payload.artist or artist,
        asset_id=asset.id,
        position=next_position(session, Track),
    )
    session.add(track)
    session.flush()
    return track


def import_upload(session: Session, filename: str, payload: bytes, title: str = "") -> Track:
    asset = media_service.store_upload(session, filename, payload, title)
    if asset.kind != MediaKind.AUDIO:
        raise ValidationError("Only audio files can be added to the playlist")

    existing = _track_for_asset(session, asset.id)
    if existing is not None:
        return existing
    return create_track(session, TrackCreate(asset_id=asset.id, title=title or Path(filename).stem))


def update_track(session: Session, track_id: int, payload: TrackUpdate) -> Track:
    track = apply_patch(require(session, Track, track_id), payload)
    session.flush()
    return track


def delete_track(session: Session, track_id: int, with_file: bool = False) -> None:
    track = require(session, Track, track_id)
    asset_id = track.asset_id
    session.delete(track)
    session.flush()
    if with_file:
        media_service.delete_asset(session, asset_id)


def mark_played(session: Session, track_id: int) -> Track:
    track = require(session, Track, track_id)
    track.play_count += 1
    track.last_played_at = now()
    session.flush()
    return track
