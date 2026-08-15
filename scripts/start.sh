#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -x .venv/bin/python ]; then
    echo "Окружение не найдено. Сначала запусти ./scripts/setup.sh" >&2
    exit 1
fi

exec .venv/bin/python run.py
