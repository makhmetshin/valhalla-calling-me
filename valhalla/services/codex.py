from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from valhalla.models import CodexChapter, CodexEntry, MediaAsset
from valhalla.schemas.codex import (
    CodexChapterCreate,
    CodexChapterRead,
    CodexChapterUpdate,
    CodexEntryCreate,
    CodexEntrySummary,
    CodexEntryUpdate,
)
from valhalla.services.errors import ValidationError
from valhalla.services.repository import apply_patch, next_position, require

__all__ = [
    "create_chapter",
    "create_entry",
    "delete_chapter",
    "delete_entry",
    "get_entry",
    "outline",
    "reading_order",
    "search",
    "update_chapter",
    "update_entry",
]


def _serialize_chapter(chapter: CodexChapter) -> CodexChapterRead:
    return CodexChapterRead(
        id=chapter.id,
        title=chapter.title,
        summary=chapter.summary,
        position=chapter.position,
        is_preset=chapter.is_preset,
        parent_id=chapter.parent_id,
        entries=[CodexEntrySummary.model_validate(entry) for entry in chapter.entries],
        children=[_serialize_chapter(child) for child in chapter.children],
    )


def outline(session: Session) -> list[CodexChapterRead]:
    statement = (
        select(CodexChapter)
        .where(CodexChapter.parent_id.is_(None))
        .order_by(CodexChapter.position, CodexChapter.id)
    )
    return [_serialize_chapter(chapter) for chapter in session.execute(statement).scalars()]


def reading_order(session: Session) -> list[int]:
    order: list[int] = []

    def walk(chapters: list[CodexChapter]) -> None:
        for chapter in sorted(chapters, key=lambda item: (item.position, item.id)):
            order.extend(entry.id for entry in chapter.entries)
            walk(chapter.children)

    roots = list(
        session.execute(select(CodexChapter).where(CodexChapter.parent_id.is_(None))).scalars()
    )
    walk(roots)
    return order


def create_chapter(session: Session, payload: CodexChapterCreate) -> CodexChapter:
    if payload.parent_id is not None:
        require(session, CodexChapter, payload.parent_id)
    chapter = CodexChapter(
        **payload.model_dump(),
        position=next_position(session, CodexChapter, parent_id=payload.parent_id),
    )
    session.add(chapter)
    session.flush()
    return chapter


def update_chapter(session: Session, chapter_id: int, payload: CodexChapterUpdate) -> CodexChapter:
    chapter = require(session, CodexChapter, chapter_id)
    if payload.parent_id is not None and (
        payload.parent_id == chapter_id or _is_descendant(session, chapter_id, payload.parent_id)
    ):
        raise ValidationError("A chapter cannot be nested inside itself")
    apply_patch(chapter, payload)
    session.flush()
    return chapter


def _is_descendant(session: Session, chapter_id: int, candidate_id: int) -> bool:
    cursor = session.get(CodexChapter, candidate_id)
    while cursor is not None and cursor.parent_id is not None:
        if cursor.parent_id == chapter_id:
            return True
        cursor = session.get(CodexChapter, cursor.parent_id)
    return False


def delete_chapter(session: Session, chapter_id: int) -> None:
    session.delete(require(session, CodexChapter, chapter_id))
    session.flush()


def get_entry(session: Session, entry_id: int) -> CodexEntry:
    return require(session, CodexEntry, entry_id)


def create_entry(session: Session, payload: CodexEntryCreate) -> CodexEntry:
    require(session, CodexChapter, payload.chapter_id)
    data = payload.model_dump(exclude={"image_ids"})
    entry = CodexEntry(
        **data,
        position=next_position(session, CodexEntry, chapter_id=payload.chapter_id),
    )
    entry.images = _load_images(session, payload.image_ids)
    session.add(entry)
    session.flush()
    return entry


def update_entry(session: Session, entry_id: int, payload: CodexEntryUpdate) -> CodexEntry:
    entry = require(session, CodexEntry, entry_id)
    if payload.chapter_id is not None:
        require(session, CodexChapter, payload.chapter_id)
    if payload.image_ids is not None:
        entry.images = _load_images(session, payload.image_ids)
    for field, value in payload.model_dump(exclude_unset=True, exclude={"image_ids"}).items():
        setattr(entry, field, value)
    session.flush()
    return entry


def delete_entry(session: Session, entry_id: int) -> None:
    session.delete(require(session, CodexEntry, entry_id))
    session.flush()


def search(session: Session, query: str, limit: int = 40) -> list[CodexEntrySummary]:
    pattern = f"%{query.strip()}%"
    statement = (
        select(CodexEntry)
        .where(CodexEntry.title.ilike(pattern) | CodexEntry.body.ilike(pattern))
        .order_by(CodexEntry.title)
        .limit(limit)
    )
    entries = session.execute(statement).scalars()
    return [CodexEntrySummary.model_validate(entry) for entry in entries]


def _load_images(session: Session, image_ids: list[int]) -> list[MediaAsset]:
    return [require(session, MediaAsset, image_id) for image_id in image_ids]
