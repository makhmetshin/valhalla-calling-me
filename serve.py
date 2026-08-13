import uvicorn

from valhalla.config import get_settings

if __name__ == "__main__":
    settings = get_settings()
    uvicorn.run(
        "valhalla.app:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
