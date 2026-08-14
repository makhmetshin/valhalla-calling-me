from __future__ import annotations

import pytest

from valhalla.media_paths import PLAYLIST_COLLECTION, collection_of, public_url
from valhalla.models import MediaKind, MediaOrigin
from valhalla.services import media as service
from valhalla.services.errors import ConflictError, ValidationError


def test_upload_is_stored_once_per_folder(session, png_bytes):
    first = service.store_upload(session, "рассвет.png", png_bytes)
    again = service.store_upload(session, "рассвет.png", png_bytes)
    elsewhere = service.store_upload(session, "рассвет.png", png_bytes, subdirectory="icons")

    assert first.id == again.id
    assert elsewhere.id != first.id
    assert elsewhere.relative_path.startswith("icons/")


def test_uploads_land_in_the_vault(session, settings, png_bytes):
    asset = service.store_upload(session, "знак.png", png_bytes, "Знак")

    assert asset.title == "Знак"
    assert asset.kind == MediaKind.IMAGE
    assert asset.origin == MediaOrigin.UPLOAD
    assert (settings.images_dir / asset.relative_path).is_file()
    assert (
        public_url(asset.kind, asset.origin, asset.relative_path)
        == f"/vault/images/{asset.relative_path}"
    )


def test_empty_and_unknown_files_are_refused(session, png_bytes):
    with pytest.raises(ValidationError):
        service.store_upload(session, "пусто.png", b"")
    with pytest.raises(ValidationError):
        service.store_upload(session, "записка.txt", b"hello")


def test_preset_assets_cannot_be_deleted(session):
    service.sync_presets(session)
    preset = next(
        asset for asset in service.list_assets(session) if asset.origin == MediaOrigin.PRESET
    )

    with pytest.raises(ConflictError):
        service.delete_asset(session, preset.id)


def test_deleting_an_upload_removes_the_file(session, settings, png_bytes):
    asset = service.store_upload(session, "знак.png", png_bytes)
    path = settings.images_dir / asset.relative_path

    service.delete_asset(session, asset.id)

    assert not path.exists()
    assert service.list_assets(session) == []


def test_scan_picks_up_files_dropped_into_the_vault(session, settings, png_bytes):
    (settings.images_dir / "icons").mkdir(parents=True, exist_ok=True)
    (settings.images_dir / "icons" / "секира.png").write_bytes(png_bytes)

    discovered = service.scan_vault(session)

    assert discovered == 1
    asset = service.list_assets(session)[0]
    assert asset.relative_path == "icons/секира.png"
    assert collection_of(asset.origin, asset.relative_path) == "icons"


def test_scan_forgets_files_that_vanished(session, settings, png_bytes):
    (settings.images_dir / "секира.png").write_bytes(png_bytes)
    service.scan_vault(session)

    (settings.images_dir / "секира.png").unlink()
    service.scan_vault(session)

    assert service.list_assets(session) == []


def test_presets_are_registered_without_the_glyphs(session):
    service.sync_presets(session)

    presets = [
        asset for asset in service.list_assets(session) if asset.origin == MediaOrigin.PRESET
    ]
    collections = {collection_of(asset.origin, asset.relative_path) for asset in presets}

    assert presets
    assert "glyphs" not in collections
    assert {"icons", "backgrounds"} <= collections


def test_presets_that_disappear_are_forgotten(session, settings, tmp_path, monkeypatch, png_bytes):
    fake_web = tmp_path / "web"
    (fake_web / "presets" / "icons").mkdir(parents=True)
    (fake_web / "presets" / "icons" / "секира.png").write_bytes(png_bytes)
    monkeypatch.setattr(settings, "web_dir", fake_web)

    assert service.sync_presets(session) == 1

    (fake_web / "presets" / "icons" / "секира.png").unlink()
    service.sync_presets(session)

    assert service.list_assets(session) == []


def test_collection_comes_from_the_first_folder():
    assert collection_of(MediaOrigin.UPLOAD, "icons/wolf.svg") == "icons"
    assert collection_of(MediaOrigin.UPLOAD, "playlist/Поход/song.wav") == PLAYLIST_COLLECTION
    assert collection_of(MediaOrigin.UPLOAD, "song.wav") == "uploads"
