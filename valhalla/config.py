from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="VALHALLA_",
        env_file=PROJECT_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    host: str = "127.0.0.1"
    port: int = 8777
    debug: bool = False

    vault_dir: Path = Field(default=PROJECT_ROOT / "vault")
    web_dir: Path = Field(default=PROJECT_ROOT / "web")

    max_upload_bytes: int = 256 * 1024 * 1024
    window_title: str = "Valhalla Calling"
    window_width: int = 1440
    window_height: int = 900

    @computed_field  # type: ignore[prop-decorator]
    @property
    def database_dir(self) -> Path:
        return self.vault_dir / "database"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def database_path(self) -> Path:
        return self.database_dir / "valhalla.db"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.database_path.as_posix()}"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def images_dir(self) -> Path:
        return self.vault_dir / "images"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def audio_dir(self) -> Path:
        return self.vault_dir / "audio"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def playlists_dir(self) -> Path:
        return self.audio_dir / "playlist"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def video_dir(self) -> Path:
        return self.vault_dir / "video"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def fonts_dir(self) -> Path:
        return self.vault_dir / "fonts"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def backups_dir(self) -> Path:
        return self.vault_dir / "backups"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def exports_dir(self) -> Path:
        return self.vault_dir / "exports"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def presets_dir(self) -> Path:
        return self.web_dir / "presets"

    @property
    def media_dirs(self) -> dict[str, Path]:
        return {
            "image": self.images_dir,
            "audio": self.audio_dir,
            "video": self.video_dir,
            "font": self.fonts_dir,
        }

    def ensure_layout(self) -> None:
        for directory in (
            self.vault_dir,
            self.database_dir,
            self.images_dir,
            self.images_dir / "icons",
            self.images_dir / "backgrounds",
            self.audio_dir,
            self.playlists_dir,
            self.video_dir,
            self.fonts_dir,
            self.backups_dir,
            self.exports_dir,
        ):
            directory.mkdir(parents=True, exist_ok=True)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
