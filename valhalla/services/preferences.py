from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from valhalla.models import Preference

DEFAULTS: dict[str, Any] = {
    "theme.palette": "",
    "theme.accent": "",
    "theme.font_heading": "",
    "theme.font_body": "",
    "audio.master_volume": 0.7,
    "audio.unlock_sound_id": None,
    "audio.reminder_sound_id": None,
    "codex.page_turn": True,
    "player.volume": 0.6,
    "player.collapsed": False,
    "player.track_id": None,
    "backgrounds": {},
}


def all_preferences(session: Session) -> dict[str, Any]:
    stored = {row.key: row.value for row in session.execute(select(Preference)).scalars()}
    return {**DEFAULTS, **stored}


def set_preferences(session: Session, values: dict[str, Any]) -> dict[str, Any]:
    for key, value in values.items():
        row = session.get(Preference, key)
        if row is None:
            session.add(Preference(key=key, value=value))
        else:
            row.value = value
    session.flush()
    return all_preferences(session)


def reset(session: Session, keys: list[str] | None = None) -> dict[str, Any]:
    statement = select(Preference)
    if keys:
        statement = statement.where(Preference.key.in_(keys))
    for row in session.execute(statement).scalars():
        session.delete(row)
    session.flush()
    return all_preferences(session)
