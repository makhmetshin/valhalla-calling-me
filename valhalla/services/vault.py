from __future__ import annotations

import shutil
import zipfile
from datetime import datetime
from pathlib import Path

from valhalla.config import get_settings
from valhalla.services.errors import NotFoundError, ValidationError

SKIPPED_DIRECTORIES = {"backups"}


def create_backup() -> Path:
    settings = get_settings()
    settings.ensure_layout()
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    archive = settings.backups_dir / f"vault-{stamp}.zip"

    with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as bundle:
        for path in sorted(settings.vault_dir.rglob("*")):
            if not path.is_file():
                continue
            relative = path.relative_to(settings.vault_dir)
            if relative.parts and relative.parts[0] in SKIPPED_DIRECTORIES:
                continue
            if path.suffix in {".db-wal", ".db-shm"}:
                continue
            bundle.write(path, relative.as_posix())
    return archive


def list_backups() -> list[dict[str, object]]:
    settings = get_settings()
    settings.ensure_layout()
    return [
        {
            "name": path.name,
            "size_bytes": path.stat().st_size,
            "created_at": datetime.fromtimestamp(path.stat().st_mtime).isoformat(
                timespec="seconds"
            ),
        }
        for path in sorted(settings.backups_dir.glob("*.zip"), reverse=True)
    ]


def restore_backup(name: str) -> None:
    settings = get_settings()
    archive = settings.backups_dir / Path(name).name
    if not archive.exists():
        raise NotFoundError(f"Backup {name} not found")

    with zipfile.ZipFile(archive) as bundle:
        for member in bundle.namelist():
            resolved = (settings.vault_dir / member).resolve()
            if not resolved.is_relative_to(settings.vault_dir.resolve()):
                raise ValidationError("Backup archive contains an unsafe path")
        bundle.extractall(settings.vault_dir)


def delete_backup(name: str) -> None:
    settings = get_settings()
    archive = settings.backups_dir / Path(name).name
    if not archive.exists():
        raise NotFoundError(f"Backup {name} not found")
    archive.unlink()


def vault_summary() -> dict[str, object]:
    settings = get_settings()
    settings.ensure_layout()
    sizes: dict[str, int] = {}
    for label, directory in settings.media_dirs.items():
        sizes[label] = sum(path.stat().st_size for path in directory.rglob("*") if path.is_file())
    total, _, free = shutil.disk_usage(settings.vault_dir)
    return {
        "path": str(settings.vault_dir),
        "database_bytes": settings.database_path.stat().st_size
        if settings.database_path.exists()
        else 0,
        "media_bytes": sizes,
        "disk_free_bytes": free,
        "disk_total_bytes": total,
    }
