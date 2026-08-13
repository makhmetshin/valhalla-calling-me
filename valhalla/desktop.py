from __future__ import annotations

import logging

import webview

from valhalla.config import Settings, get_settings
from valhalla.server import BackgroundServer, find_free_port

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


def window_options(settings: Settings) -> dict[str, object]:
    return {
        "width": settings.window_width,
        "height": settings.window_height,
        "min_size": (1024, 680),
        "background_color": "#080b10",
        "text_select": True,
    }


def launch() -> None:
    settings = get_settings()
    port = find_free_port(settings.host, settings.port)
    server = BackgroundServer(settings, port)
    server.start()

    webview.create_window(settings.window_title, server.base_url, **window_options(settings))
    try:
        webview.start()
    finally:
        server.stop()


if __name__ == "__main__":
    launch()
