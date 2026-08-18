from __future__ import annotations

from fastapi import APIRouter, status

from valhalla.api.deps import DbSession
from valhalla.models import CodexChapter, CodexEntry
from valhalla.schemas.codex import (
    CodexChapterCreate,
    CodexChapterRead,
    CodexChapterUpdate,
    CodexEntryCreate,
    CodexEntryRead,
    CodexEntrySummary,
    CodexEntryUpdate,
)
from valhalla.schemas.common import OrderUpdate
from valhalla.services import codex as service
from valhalla.services.repository import apply_order

router = APIRouter(prefix="/codex", tags=["codex"])


@router.get("/outline", response_model=list[CodexChapterRead])
def outline(session: DbSession) -> list[CodexChapterRead]:
    return service.outline(session)


@router.get("/reading-order", response_model=list[int])
def reading_order(session: DbSession) -> list[int]:
    return service.reading_order(session)


@router.get("/search", response_model=list[CodexEntrySummary])
def search(session: DbSession, q: str, limit: int = 40) -> list[CodexEntrySummary]:
    return service.search(session, q, limit)


@router.post("/chapters", response_model=CodexChapterRead, status_code=status.HTTP_201_CREATED)
def create_chapter(session: DbSession, payload: CodexChapterCreate) -> CodexChapterRead:
    chapter = service.create_chapter(session, payload)
    return CodexChapterRead(
        id=chapter.id,
        title=chapter.title,
        summary=chapter.summary,
        position=chapter.position,
        is_preset=chapter.is_preset,
        parent_id=chapter.parent_id,
        entries=[],
        children=[],
    )


@router.patch("/chapters/{chapter_id}")
def update_chapter(
    session: DbSession, chapter_id: int, payload: CodexChapterUpdate
) -> dict[str, int]:
    chapter = service.update_chapter(session, chapter_id, payload)
    return {"id": chapter.id}


@router.delete(
    "/chapters/{chapter_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None
)
def delete_chapter(session: DbSession, chapter_id: int) -> None:
    service.delete_chapter(session, chapter_id)


@router.post("/chapters/order", response_model=list[CodexChapterRead])
def reorder_chapters(session: DbSession, payload: OrderUpdate) -> list[CodexChapterRead]:
    apply_order(session, CodexChapter, payload.ids)
    return service.outline(session)


@router.get("/entries/{entry_id}", response_model=CodexEntryRead)
def get_entry(session: DbSession, entry_id: int) -> CodexEntry:
    return service.get_entry(session, entry_id)


@router.post("/entries", response_model=CodexEntryRead, status_code=status.HTTP_201_CREATED)
def create_entry(session: DbSession, payload: CodexEntryCreate) -> CodexEntry:
    return service.create_entry(session, payload)


@router.patch("/entries/{entry_id}", response_model=CodexEntryRead)
def update_entry(session: DbSession, entry_id: int, payload: CodexEntryUpdate) -> CodexEntry:
    return service.update_entry(session, entry_id, payload)


@router.delete("/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_entry(session: DbSession, entry_id: int) -> None:
    service.delete_entry(session, entry_id)


@router.post("/entries/order", response_model=list[CodexChapterRead])
def reorder_entries(session: DbSession, payload: OrderUpdate) -> list[CodexChapterRead]:
    apply_order(session, CodexEntry, payload.ids)
    return service.outline(session)
