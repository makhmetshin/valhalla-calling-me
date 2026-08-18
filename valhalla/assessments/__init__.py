from __future__ import annotations

from valhalla.assessments.burns import BURNS_DEPRESSION_CHECKLIST
from valhalla.assessments.definitions import (
    Band,
    Choice,
    Instrument,
    Question,
    Section,
    localize,
)

CATALOG: tuple[Instrument, ...] = (BURNS_DEPRESSION_CHECKLIST,)

_BY_SLUG = {instrument.slug: instrument for instrument in CATALOG}


def list_instruments() -> tuple[Instrument, ...]:
    return CATALOG


def find(slug: str) -> Instrument | None:
    return _BY_SLUG.get(slug)


__all__ = [
    "CATALOG",
    "Band",
    "Choice",
    "Instrument",
    "Question",
    "Section",
    "find",
    "list_instruments",
    "localize",
]
