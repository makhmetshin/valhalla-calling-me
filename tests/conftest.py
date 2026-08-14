from __future__ import annotations

import math
import os
import shutil
import struct
import tempfile
import wave
from collections.abc import Iterator
from pathlib import Path

import pytest

VAULT_DIR = Path(tempfile.mkdtemp(prefix="valhalla-tests-"))
os.environ["VALHALLA_VAULT_DIR"] = str(VAULT_DIR)

PIXEL_PNG = bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d4944415478da63f8cfc0f01f0003030200fa0dc93e"
    "0000000049454e44ae426082"
)


@pytest.fixture(scope="session", autouse=True)
def vault() -> Iterator[Path]:
    from valhalla.db.session import engine

    yield VAULT_DIR
    engine.dispose()
    shutil.rmtree(VAULT_DIR, ignore_errors=True)


@pytest.fixture(autouse=True)
def clean_state() -> Iterator[None]:
    from valhalla.config import get_settings
    from valhalla.db.base import Base
    from valhalla.db.session import engine

    settings = get_settings()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    for directory in (
        settings.images_dir,
        settings.audio_dir,
        settings.video_dir,
        settings.exports_dir,
    ):
        shutil.rmtree(directory, ignore_errors=True)
    settings.ensure_layout()
    yield


@pytest.fixture
def settings():
    from valhalla.config import get_settings

    return get_settings()


@pytest.fixture
def session() -> Iterator:
    from valhalla.db.session import session_scope

    with session_scope() as active:
        yield active


@pytest.fixture
def client() -> Iterator:
    from fastapi.testclient import TestClient

    from valhalla.app import create_app

    with TestClient(create_app()) as active:
        yield active


@pytest.fixture
def wav_bytes():
    def build(freq: float = 220.0, seconds: float = 0.2) -> bytes:
        frames = int(11025 * seconds)
        payload = b"".join(
            struct.pack("<h", int(8000 * math.sin(2 * math.pi * freq * index / 11025)))
            for index in range(frames)
        )
        target = VAULT_DIR / "scratch.wav"
        with wave.open(str(target), "w") as handle:
            handle.setnchannels(1)
            handle.setsampwidth(2)
            handle.setframerate(11025)
            handle.writeframes(payload)
        data = target.read_bytes()
        target.unlink()
        return data

    return build


@pytest.fixture
def png_bytes() -> bytes:
    return PIXEL_PNG


@pytest.fixture
def make_playlist_files(settings, wav_bytes, png_bytes):
    def build(folder: str, filenames: list[str], cover: str = "") -> Path:
        target = settings.playlists_dir / folder
        target.mkdir(parents=True, exist_ok=True)
        for index, name in enumerate(filenames):
            (target / name).write_bytes(wav_bytes(220.0 + index * 40))
        if cover:
            (target / cover).write_bytes(png_bytes)
        return target

    return build
