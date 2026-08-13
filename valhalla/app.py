from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from valhalla import __version__
from valhalla.api import api_router
from valhalla.config import get_settings
from valhalla.db.seed import seed_all
from valhalla.db.session import init_database, session_scope
from valhalla.media_paths import PRESET_MOUNT, VAULT_MOUNT
from valhalla.services.errors import DomainError
from valhalla.services.media import sync_presets

logger = logging.getLogger("valhalla")


def bootstrap() -> None:
    settings = get_settings()
    settings.ensure_layout()
    init_database()
    with session_scope() as session:
        sync_presets(session)
        seed_all(session)


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    bootstrap()
    logger.info("Valhalla %s is awake", __version__)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    application = FastAPI(
        title="Valhalla Calling",
        version=__version__,
        lifespan=lifespan,
        docs_url="/api/docs",
        openapi_url="/api/openapi.json",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @application.exception_handler(DomainError)
    async def domain_error_handler(_: Request, error: DomainError) -> JSONResponse:
        return JSONResponse(status_code=error.status_code, content={"detail": str(error)})

    application.include_router(api_router)

    settings.ensure_layout()
    application.mount(VAULT_MOUNT, StaticFiles(directory=settings.vault_dir), name="vault")
    if settings.presets_dir.exists():
        application.mount(PRESET_MOUNT, StaticFiles(directory=settings.presets_dir), name="presets")
    application.mount("/assets", StaticFiles(directory=settings.web_dir / "assets"), name="assets")

    @application.get("/", include_in_schema=False)
    async def index() -> FileResponse:
        return FileResponse(settings.web_dir / "index.html")

    return application


app = create_app()
