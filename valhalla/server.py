from __future__ import annotations

import socket
import threading
import time
from contextlib import closing

import uvicorn

from valhalla.config import Settings


def find_free_port(host: str, preferred: int) -> int:
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as probe:
        try:
            probe.bind((host, preferred))
        except OSError:
            with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as fallback:
                fallback.bind((host, 0))
                return int(fallback.getsockname()[1])
    return preferred


class BackgroundServer:
    def __init__(self, settings: Settings, port: int) -> None:
        config = uvicorn.Config(
            "valhalla.app:app",
            host=settings.host,
            port=port,
            log_level="info" if settings.debug else "warning",
            access_log=settings.debug,
        )
        self._server = uvicorn.Server(config)
        self._thread = threading.Thread(
            target=self._server.run, name="valhalla-server", daemon=True
        )
        self.base_url = f"http://{settings.host}:{port}"

    def start(self, timeout: float = 20.0) -> None:
        self._thread.start()
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            if self._server.started:
                return
            time.sleep(0.05)
        raise RuntimeError("The server did not start in time")

    def stop(self) -> None:
        self._server.should_exit = True
        self._thread.join(timeout=5)
