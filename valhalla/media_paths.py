from __future__ import annotations

from pathlib import Path

from valhalla.config import get_settings
from valhalla.models.enums import MediaKind, MediaOrigin

KIND_DIRECTORIES: dict[MediaKind, str] = {
    MediaKind.IMAGE: "images",
    MediaKind.AUDIO: "audio",
    MediaKind.VIDEO: "video",
    MediaKind.FONT: "fonts",
}

VAULT_MOUNT = "/vault"
PRESET_MOUNT = "/presets"

UPLOAD_COLLECTION = "uploads"
GLYPH_COLLECTION = "glyphs"


def collection_of(origin: MediaOrigin, relative_path: str) -> str:
    if origin == MediaOrigin.UPLOAD:
        return UPLOAD_COLLECTION
    head, separator, _ = relative_path.replace("\\", "/").lstrip("/").partition("/")
    return head if separator else UPLOAD_COLLECTION


def public_url(kind: MediaKind, origin: MediaOrigin, relative_path: str) -> str:
    normalized = relative_path.replace("\\", "/").lstrip("/")
    if origin == MediaOrigin.PRESET:
        return f"{PRESET_MOUNT}/{normalized}"
    return f"{VAULT_MOUNT}/{KIND_DIRECTORIES[kind]}/{normalized}"


def absolute_path(kind: MediaKind, origin: MediaOrigin, relative_path: str) -> Path:
    settings = get_settings()
    normalized = relative_path.replace("\\", "/").lstrip("/")
    if origin == MediaOrigin.PRESET:
        return settings.presets_dir / normalized
    return settings.vault_dir / KIND_DIRECTORIES[kind] / normalized
