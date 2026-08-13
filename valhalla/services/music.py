from __future__ import annotations

import re
from pathlib import Path

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from valhalla.config import get_settings
from valhalla.db.base import now
from valhalla.media_paths import PLAYLIST_COLLECTION, VAULT_MOUNT
from valhalla.models import MediaAsset, MediaKind, MediaOrigin, Playlist, Track
from valhalla.schemas.media import MediaRead
from valhalla.schemas.music import (
    PlaylistCreate,
    PlaylistRead,
    PlaylistUpdate,
    TrackCreate,
    TrackUpdate,
)
from valhalla.services import media as media_service
from valhalla.services.errors import ConflictError, ValidationError
from valhalla.services.repository import apply_patch, require

ORDER_PREFIX = re.compile(r"^\d{1,3}[\s._-]+")
COVER_SUFFIXES = (".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif")
FOLDER_SAFE = re.compile(r"[^\w \-.]+", re.UNICODE)


def _split_name(source: str) -> tuple[str, str]:
    cleaned = ORDER_PREFIX.sub("", source.strip())
    if " - " in cleaned:
        artist, _, title = cleaned.partition(" - ")
        return title.strip(), artist.strip()
    return cleaned, ""


def _folder_name(name: str) -> str:
    cleaned = FOLDER_SAFE.sub(" ", name).strip(" .")
    return " ".join(cleaned.split()) or "playlist"


def _track_for_asset(session: Session, asset_id: int) -> Track | None:
    return session.execute(select(Track).where(Track.asset_id == asset_id)).scalar_one_or_none()


def _next_track_position(session: Session, playlist_id: int) -> int:
    highest = session.execute(
        select(func.max(Track.position)).where(Track.playlist_id == playlist_id)
    ).scalar()
    return 0 if highest is None else highest + 1


def playlist_path(playlist: Playlist) -> Path:
    return get_settings().playlists_dir / playlist.directory


def list_playlists(session: Session) -> list[Playlist]:
    statement = select(Playlist).order_by(Playlist.position, Playlist.id)
    return list(session.execute(statement).scalars())


def serialize_playlist(session: Session, playlist: Playlist) -> PlaylistRead:
    count = session.execute(
        select(func.count()).select_from(Track).where(Track.playlist_id == playlist.id)
    ).scalar_one()

    cover = None
    if playlist.cover_path:
        cover = f"{VAULT_MOUNT}/{playlist.cover_path}"
    elif playlist.icon is not None:
        cover = MediaRead.model_validate(playlist.icon).url

    return PlaylistRead(
        id=playlist.id,
        name=playlist.name,
        directory=playlist.directory,
        position=playlist.position,
        icon_id=playlist.icon_id,
        icon=MediaRead.model_validate(playlist.icon) if playlist.icon else None,
        cover_url=cover,
        track_count=count,
        created_at=playlist.created_at,
    )


def create_playlist(session: Session, payload: PlaylistCreate) -> Playlist:
    directory = _folder_name(payload.name)
    taken = session.execute(
        select(Playlist).where(Playlist.directory == directory)
    ).scalar_one_or_none()
    if taken is not None:
        raise ConflictError("A playlist with this name already exists")

    (get_settings().playlists_dir / directory).mkdir(parents=True, exist_ok=True)

    highest = session.execute(select(func.max(Playlist.position))).scalar()
    playlist = Playlist(
        name=payload.name.strip(),
        directory=directory,
        icon_id=payload.icon_id,
        position=0 if highest is None else highest + 1,
    )
    session.add(playlist)
    session.flush()
    return playlist


def update_playlist(session: Session, playlist_id: int, payload: PlaylistUpdate) -> Playlist:
    playlist = require(session, Playlist, playlist_id)
    renamed = payload.name is not None and payload.name.strip() != playlist.name
    apply_patch(playlist, payload)
    if renamed:
        _rename_directory(session, playlist)
    session.flush()
    return playlist


def _rename_directory(session: Session, playlist: Playlist) -> None:
    directory = _folder_name(playlist.name)
    if directory == playlist.directory:
        return

    settings = get_settings()
    source = settings.playlists_dir / playlist.directory
    target = settings.playlists_dir / directory
    if target.exists():
        raise ConflictError("A folder with this name already exists")
    if source.exists():
        source.rename(target)

    old_prefix = f"{PLAYLIST_COLLECTION}/{playlist.directory}/"
    new_prefix = f"{PLAYLIST_COLLECTION}/{directory}/"
    assets = session.execute(
        select(MediaAsset).where(MediaAsset.relative_path.startswith(old_prefix))
    ).scalars()
    for asset in assets:
        asset.relative_path = new_prefix + asset.relative_path[len(old_prefix) :]
    if playlist.cover_path:
        playlist.cover_path = playlist.cover_path.replace(old_prefix, new_prefix, 1)
    playlist.directory = directory


def delete_playlist(session: Session, playlist_id: int, with_files: bool = False) -> None:
    playlist = require(session, Playlist, playlist_id)
    asset_ids = [track.asset_id for track in playlist.tracks]
    folder = playlist_path(playlist)

    session.delete(playlist)
    session.flush()

    if not with_files:
        return

    for asset_id in asset_ids:
        asset = session.get(MediaAsset, asset_id)
        if asset is not None and asset.origin == MediaOrigin.UPLOAD:
            media_service.delete_asset(session, asset_id)
    if folder.exists():
        for path in sorted(folder.rglob("*"), reverse=True):
            if path.is_file():
                path.unlink()
            else:
                path.rmdir()
        folder.rmdir()


def list_tracks(session: Session, playlist_id: int | None = None) -> list[Track]:
    if playlist_id is None:
        statement = select(Track).order_by(func.lower(Track.title), Track.id)
    else:
        statement = (
            select(Track).where(Track.playlist_id == playlist_id).order_by(Track.position, Track.id)
        )
    return list(session.execute(statement).scalars())


def create_track(session: Session, payload: TrackCreate) -> Track:
    playlist = require(session, Playlist, payload.playlist_id)
    asset = require(session, MediaAsset, payload.asset_id)
    if asset.kind != MediaKind.AUDIO:
        raise ValidationError("Only audio files can be added to a playlist")
    if _track_for_asset(session, asset.id) is not None:
        raise ConflictError("This file is already in a playlist")

    title, artist = _split_name(payload.title or asset.title)
    track = Track(
        title=title or asset.title,
        artist=payload.artist or artist,
        playlist_id=playlist.id,
        asset_id=asset.id,
        position=_next_track_position(session, playlist.id),
    )
    session.add(track)
    session.flush()
    return track


def import_upload(
    session: Session, playlist_id: int, filename: str, payload: bytes, title: str = ""
) -> Track:
    playlist = require(session, Playlist, playlist_id)
    asset = media_service.store_upload(
        session,
        filename,
        payload,
        title,
        subdirectory=f"{PLAYLIST_COLLECTION}/{playlist.directory}",
    )
    if asset.kind != MediaKind.AUDIO:
        raise ValidationError("Only audio files can be added to a playlist")

    existing = _track_for_asset(session, asset.id)
    if existing is not None:
        return existing
    return create_track(
        session,
        TrackCreate(playlist_id=playlist.id, asset_id=asset.id, title=title or Path(filename).stem),
    )


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


def sync_playlists(session: Session) -> int:
    settings = get_settings()
    root = settings.playlists_dir
    root.mkdir(parents=True, exist_ok=True)

    known = {playlist.directory: playlist for playlist in list_playlists(session)}
    highest = session.execute(select(func.max(Playlist.position))).scalar()
    position = 0 if highest is None else highest + 1

    for folder in sorted(path for path in root.iterdir() if path.is_dir()):
        playlist = known.get(folder.name)
        if playlist is None:
            playlist = Playlist(name=folder.name, directory=folder.name, position=position)
            session.add(playlist)
            known[folder.name] = playlist
            position += 1
        playlist.cover_path = _find_cover(folder)

    session.flush()
    added = _attach_tracks(session, known)
    _adopt_orphans(session, known)
    return added


def _find_cover(folder: Path) -> str:
    vault = get_settings().vault_dir
    for path in sorted(folder.iterdir()):
        if path.is_file() and path.suffix.lower() in COVER_SUFFIXES:
            return path.relative_to(vault).as_posix()
    return ""


def _attach_tracks(session: Session, known: dict[str, Playlist]) -> int:
    statement = (
        select(MediaAsset)
        .where(
            MediaAsset.kind == MediaKind.AUDIO,
            MediaAsset.origin == MediaOrigin.UPLOAD,
            MediaAsset.relative_path.startswith(f"{PLAYLIST_COLLECTION}/"),
        )
        .order_by(MediaAsset.relative_path)
    )

    added = 0
    for asset in session.execute(statement).scalars():
        parts = asset.relative_path.split("/")
        if len(parts) < 3:
            continue
        playlist = known.get(parts[1])
        if playlist is None or _track_for_asset(session, asset.id) is not None:
            continue
        create_track(
            session,
            TrackCreate(
                playlist_id=playlist.id,
                asset_id=asset.id,
                title=Path(asset.relative_path).stem,
            ),
        )
        added += 1
    return added


def _adopt_orphans(session: Session, known: dict[str, Playlist]) -> None:
    orphans = list(session.execute(select(Track).where(Track.playlist_id.is_(None))).scalars())
    if not orphans:
        return

    shelter = next(iter(known.values()), None)
    if shelter is None:
        shelter = create_playlist(session, PlaylistCreate(name="Valhalla"))
        known[shelter.directory] = shelter

    for track in orphans:
        folder = Path(track.asset.relative_path).parent.name
        target = known.get(folder, shelter)
        track.playlist_id = target.id
        track.position = _next_track_position(session, target.id)
    session.flush()
