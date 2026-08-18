from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query, status

from valhalla.api.deps import DbSession
from valhalla.schemas.assessments import (
    AttemptDetailRead,
    AttemptRead,
    AttemptWrite,
    InstrumentRead,
    InstrumentSummary,
)
from valhalla.services import assessments as service

router = APIRouter(prefix="/assessments", tags=["assessments"])

Language = Annotated[str, Query(min_length=2, max_length=5)]


@router.get("", response_model=list[InstrumentSummary])
def list_instruments(session: DbSession, language: Language = "ru") -> list[InstrumentSummary]:
    return service.list_instruments(session, language)


@router.get("/attempts/{attempt_id}", response_model=AttemptDetailRead)
def read_attempt(
    session: DbSession, attempt_id: int, language: Language = "ru"
) -> AttemptDetailRead:
    return service.read_attempt(session, attempt_id, language)


@router.delete(
    "/attempts/{attempt_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None
)
def delete_attempt(session: DbSession, attempt_id: int) -> None:
    service.delete_attempt(session, attempt_id)


@router.get("/{slug}", response_model=InstrumentRead)
def read_instrument(slug: str, language: Language = "ru") -> InstrumentRead:
    return service.describe(service.require_instrument(slug), language)


@router.get("/{slug}/attempts", response_model=list[AttemptRead])
def list_attempts(
    session: DbSession,
    slug: str,
    since: datetime | None = None,
    until: datetime | None = None,
    language: Language = "ru",
) -> list[AttemptRead]:
    return service.list_attempts(session, slug, since, until, language)


@router.post(
    "/{slug}/attempts", response_model=AttemptDetailRead, status_code=status.HTTP_201_CREATED
)
def record_attempt(
    session: DbSession, slug: str, payload: AttemptWrite, language: Language = "ru"
) -> AttemptDetailRead:
    return service.record_attempt(session, slug, payload, language)
