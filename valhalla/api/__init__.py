from fastapi import APIRouter

from valhalla.api.routes import (
    achievements,
    assessments,
    codex,
    export,
    links,
    media,
    metrics,
    music,
    planning,
    reminders,
    system,
    tablets,
    tasks,
)

api_router = APIRouter(prefix="/api")
api_router.include_router(system.router)
api_router.include_router(media.router)
api_router.include_router(achievements.router)
api_router.include_router(metrics.router)
api_router.include_router(tasks.router)
api_router.include_router(planning.router)
api_router.include_router(reminders.router)
api_router.include_router(codex.router)
api_router.include_router(tablets.router)
api_router.include_router(assessments.router)
api_router.include_router(music.router)
api_router.include_router(links.router)
api_router.include_router(export.router)

__all__ = ["api_router"]
