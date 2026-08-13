from __future__ import annotations

import hashlib
import mimetypes
import re
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from valhalla.config import get_settings
from valhalla.media_paths import KIND_DIRECTORIES, absolute_path
from valhalla.models import MediaAsset, MediaKind, MediaOrigin
from valhalla.services.errors import ConflictError, ValidationError
from valhalla.services.repository import require

EXTRA_MIME_TYPES = {
    ".svg": "image/svg+xml",
    ".webm": "video/webm",
    ".webp": "image/webp",
    ".avif": "image/avif",
    ".ogg": "audio/ogg",
    ".opus": "audio/opus",
    ".flac": "audio/flac",
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
}

MIME_PREFIX_TO_KIND = {
    "image/": MediaKind.IMAGE,
    "audio/": MediaKind.AUDIO,
    "video/": MediaKind.VIDEO,
    "font/": MediaKind.FONT,
}

SAFE_NAME = re.compile(r"[^a-zA-Z0-9._-]+")


def guess_mime_type(filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    if suffix in EXTRA_MIME_TYPES:
        return EXTRA_MIME_TYPES[suffix]
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


def kind_for_mime(mime_type: str) -> MediaKind:
    for prefix, kind in MIME_PREFIX_TO_KIND.items():
        if mime_type.startswith(prefix):
            return kind
    raise ValidationError(f"Unsupported media type: {mime_type}")


def readable_name(filename: str) -> str:
    return Path(filename).stem.replace("-", " ").replace("_", " ").strip() or "asset"


def slugify(filename: str) -> str:
    stem = SAFE_NAME.sub("-", Path(filename).stem).strip("-").lower()
    return stem or "asset"


def list_assets(session: Session, kind: MediaKind | None = None) -> list[MediaAsset]:
    statement = select(MediaAsset).order_by(
        MediaAsset.origin, MediaAsset.kind, MediaAsset.title, MediaAsset.id
    )
    if kind is not None:
        statement = statement.where(MediaAsset.kind == kind)
    return list(session.execute(statement).scalars())


def store_upload(session: Session, filename: str, payload: bytes, title: str = "") -> MediaAsset:
    settings = get_settings()
    if not payload:
        raise ValidationError("Empty file")
    if len(payload) > settings.max_upload_bytes:
        raise ValidationError("File exceeds the allowed size")

    mime_type = guess_mime_type(filename)
    kind = kind_for_mime(mime_type)
    checksum = hashlib.sha256(payload).hexdigest()

    existing = session.execute(
        select(MediaAsset).where(
            MediaAsset.checksum == checksum,
            MediaAsset.kind == kind,
            MediaAsset.origin == MediaOrigin.UPLOAD,
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing

    suffix = Path(filename).suffix.lower() or Path(filename).suffix
    relative_path = f"{slugify(filename)}-{checksum[:10]}{suffix}"
    target = settings.vault_dir / KIND_DIRECTORIES[kind] / relative_path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(payload)

    asset = MediaAsset(
        kind=kind,
        origin=MediaOrigin.UPLOAD,
        title=title.strip() or Path(filename).stem,
        relative_path=relative_path,
        mime_type=mime_type,
        size_bytes=len(payload),
        checksum=checksum,
    )
    session.add(asset)
    session.flush()
    return asset


def rename_asset(session: Session, asset_id: int, title: str) -> MediaAsset:
    asset = require(session, MediaAsset, asset_id)
    asset.title = title.strip() or asset.title
    session.flush()
    return asset


def delete_asset(session: Session, asset_id: int) -> None:
    asset = require(session, MediaAsset, asset_id)
    if asset.origin == MediaOrigin.PRESET:
        raise ConflictError("Preset assets cannot be removed")
    path = absolute_path(asset.kind, asset.origin, asset.relative_path)
    session.delete(asset)
    session.flush()
    path.unlink(missing_ok=True)


def checksum_of(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def scan_vault(session: Session) -> int:
    settings = get_settings()
    known = {
        (str(asset.kind), asset.relative_path)
        for asset in session.execute(
            select(MediaAsset).where(MediaAsset.origin == MediaOrigin.UPLOAD)
        ).scalars()
    }

    discovered = 0
    for kind, directory in KIND_DIRECTORIES.items():
        root = settings.vault_dir / directory
        if not root.exists():
            continue
        for path in sorted(root.rglob("*")):
            if not path.is_file():
                continue
            relative_path = path.relative_to(root).as_posix()
            if (str(kind), relative_path) in known:
                continue
            mime_type = guess_mime_type(path.name)
            try:
                if kind_for_mime(mime_type) != kind:
                    continue
            except ValidationError:
                continue
            session.add(
                MediaAsset(
                    kind=kind,
                    origin=MediaOrigin.UPLOAD,
                    title=readable_name(path.name),
                    relative_path=relative_path,
                    mime_type=mime_type,
                    size_bytes=path.stat().st_size,
                    checksum=checksum_of(path),
                )
            )
            discovered += 1

    session.flush()
    return discovered


def sync_presets(session: Session) -> int:
    settings = get_settings()
    presets_root = settings.presets_dir
    if not presets_root.exists():
        return 0

    known = {
        asset.relative_path: asset
        for asset in session.execute(
            select(MediaAsset).where(MediaAsset.origin == MediaOrigin.PRESET)
        ).scalars()
    }

    discovered = 0
    for path in sorted(presets_root.rglob("*")):
        if not path.is_file():
            continue
        mime_type = guess_mime_type(path.name)
        try:
            kind = kind_for_mime(mime_type)
        except ValidationError:
            continue
        relative_path = path.relative_to(presets_root).as_posix()
        title = path.stem.replace("-", " ").replace("_", " ").title()
        asset = known.get(relative_path)
        if asset is None:
            session.add(
                MediaAsset(
                    kind=kind,
                    origin=MediaOrigin.PRESET,
                    title=title,
                    relative_path=relative_path,
                    mime_type=mime_type,
                    size_bytes=path.stat().st_size,
                )
            )
            discovered += 1
        else:
            asset.size_bytes = path.stat().st_size
            asset.mime_type = mime_type

    for relative_path, asset in known.items():
        if not (presets_root / relative_path).exists():
            session.delete(asset)

    session.flush()
    return discovered
