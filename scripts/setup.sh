#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -d .venv ]; then
    python3.12 -m venv --system-site-packages .venv 2>/dev/null ||
        python3 -m venv --system-site-packages .venv
fi

.venv/bin/python -m pip install --upgrade pip
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python tools/generate_presets.py

window_ready() {
    .venv/bin/python - <<'PY' >/dev/null 2>&1
import gi

for version in ("4.1", "4.0"):
    try:
        gi.require_version("WebKit2", version)
        raise SystemExit(0)
    except ValueError:
        pass
raise SystemExit(1)
PY
}

if ! window_ready; then
    echo
    echo "Окно рисует GTK, и его ставит система, а не pip:"
    echo "  Debian/Ubuntu: sudo apt install python3-gi python3-gi-cairo gir1.2-webkit2-4.1"
    echo "  Fedora:        sudo dnf install python3-gobject webkit2gtk4.1"
    echo "  Arch:          sudo pacman -S python-gobject webkit2gtk-4.1"
    echo "Без него окна не будет, но сервер поднимется: .venv/bin/python serve.py"
fi

echo
echo "Готово. Запуск: ./scripts/start.sh"
