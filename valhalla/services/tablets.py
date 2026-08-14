from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from valhalla.db.base import now
from valhalla.models import TabletCell, TabletColumn, TabletKind, TabletPage, TabletRow
from valhalla.schemas.media import MediaRead
from valhalla.schemas.tablets import (
    TabletColumnRead,
    TabletColumnWrite,
    TabletKindCreate,
    TabletKindRead,
    TabletKindUpdate,
    TabletPageCreate,
    TabletPageRead,
    TabletPageSummary,
    TabletPageUpdate,
    TabletRowRead,
    TabletRowWrite,
)
from valhalla.services.errors import ValidationError
from valhalla.services.repository import next_position, require

__all__ = [
    "add_row",
    "create_kind",
    "create_page",
    "delete_kind",
    "delete_page",
    "get_page",
    "list_kinds",
    "list_pages",
    "save_page",
    "serialize_kind",
    "serialize_page",
    "update_kind",
]


def serialize_kind(session: Session, kind: TabletKind) -> TabletKindRead:
    pages = session.execute(
        select(func.count(TabletPage.id)).where(TabletPage.kind_id == kind.id)
    ).scalar_one()
    return TabletKindRead(
        id=kind.id,
        title=kind.title,
        summary=kind.summary,
        position=kind.position,
        icon_id=kind.icon_id,
        icon=MediaRead.model_validate(kind.icon) if kind.icon else None,
        columns=[TabletColumnRead.model_validate(column) for column in kind.columns],
        page_count=int(pages),
    )


def serialize_page(page: TabletPage) -> TabletPageRead:
    return TabletPageRead(
        id=page.id,
        kind_id=page.kind_id,
        title=page.title,
        purpose=page.purpose,
        position=page.position,
        updated_at=page.updated_at,
        rows=[
            TabletRowRead(
                id=row.id,
                position=row.position,
                cells={cell.column_id: cell.value for cell in row.cells},
            )
            for row in page.rows
        ],
    )


def list_kinds(session: Session) -> list[TabletKindRead]:
    statement = select(TabletKind).order_by(TabletKind.position, TabletKind.id)
    return [serialize_kind(session, kind) for kind in session.execute(statement).scalars()]


def create_kind(session: Session, payload: TabletKindCreate) -> TabletKindRead:
    kind = TabletKind(
        title=payload.title,
        summary=payload.summary,
        icon_id=payload.icon_id,
        position=next_position(session, TabletKind),
    )
    session.add(kind)
    session.flush()
    _apply_columns(session, kind, payload.columns)
    session.flush()
    session.refresh(kind)
    return serialize_kind(session, kind)


def update_kind(session: Session, kind_id: int, payload: TabletKindUpdate) -> TabletKindRead:
    kind = require(session, TabletKind, kind_id)
    data = payload.model_dump(exclude_unset=True, exclude={"columns"})
    for field, value in data.items():
        setattr(kind, field, value)
    if payload.columns is not None:
        if not payload.columns:
            raise ValidationError("A tablet needs at least one column")
        _apply_columns(session, kind, payload.columns)
    session.flush()
    session.refresh(kind)
    return serialize_kind(session, kind)


def delete_kind(session: Session, kind_id: int) -> None:
    session.delete(require(session, TabletKind, kind_id))
    session.flush()


def _apply_columns(session: Session, kind: TabletKind, columns: list[TabletColumnWrite]) -> None:
    known = {column.id: column for column in kind.columns}
    keep: set[int] = set()

    for position, incoming in enumerate(columns):
        existing = known.get(incoming.id) if incoming.id is not None else None
        if existing is None:
            session.add(TabletColumn(kind_id=kind.id, title=incoming.title, position=position))
            continue
        existing.title = incoming.title
        existing.position = position
        keep.add(existing.id)

    for column in kind.columns:
        if column.id not in keep:
            session.delete(column)
    session.flush()


def list_pages(session: Session, kind_id: int) -> list[TabletPageSummary]:
    require(session, TabletKind, kind_id)
    statement = (
        select(TabletPage)
        .where(TabletPage.kind_id == kind_id)
        .order_by(TabletPage.position, TabletPage.id)
    )
    return [TabletPageSummary.model_validate(page) for page in session.execute(statement).scalars()]


def get_page(session: Session, page_id: int) -> TabletPageRead:
    return serialize_page(require(session, TabletPage, page_id))


def create_page(session: Session, payload: TabletPageCreate) -> TabletPageRead:
    kind = require(session, TabletKind, payload.kind_id)
    if not kind.columns:
        raise ValidationError("Add columns to the tablet before starting a page")
    page = TabletPage(
        kind_id=kind.id,
        title=payload.title,
        purpose=payload.purpose,
        position=next_position(session, TabletPage, kind_id=kind.id),
    )
    session.add(page)
    session.flush()
    session.add(TabletRow(page_id=page.id, position=0))
    session.flush()
    session.refresh(page)
    return serialize_page(page)


def save_page(session: Session, page_id: int, payload: TabletPageUpdate) -> TabletPageRead:
    page = require(session, TabletPage, page_id)
    data = payload.model_dump(exclude_unset=True, exclude={"rows"})
    for field, value in data.items():
        setattr(page, field, value)
    if payload.rows is not None:
        _apply_rows(session, page, payload.rows)
    page.updated_at = now()
    session.flush()
    session.refresh(page)
    return serialize_page(page)


def delete_page(session: Session, page_id: int) -> None:
    session.delete(require(session, TabletPage, page_id))
    session.flush()


def add_row(session: Session, page_id: int) -> TabletPageRead:
    page = require(session, TabletPage, page_id)
    session.add(
        TabletRow(page_id=page.id, position=next_position(session, TabletRow, page_id=page.id))
    )
    session.flush()
    session.refresh(page)
    return serialize_page(page)


def _apply_rows(session: Session, page: TabletPage, rows: list[TabletRowWrite]) -> None:
    allowed = {column.id for column in page.kind.columns}
    known = {row.id: row for row in page.rows}
    keep: set[int] = set()

    for position, incoming in enumerate(rows):
        row = known.get(incoming.id) if incoming.id is not None else None
        if row is None:
            row = TabletRow(page_id=page.id, position=position)
            session.add(row)
            session.flush()
        else:
            row.position = position
            keep.add(row.id)
        _apply_cells(session, row, incoming.cells, allowed)

    for row in page.rows:
        if row.id not in keep:
            session.delete(row)
    session.flush()


def _apply_cells(
    session: Session, row: TabletRow, values: dict[int, str], allowed: set[int]
) -> None:
    cells = {cell.column_id: cell for cell in row.cells}
    for column_id, value in values.items():
        if column_id not in allowed:
            continue
        cell = cells.get(column_id)
        if cell is None:
            session.add(TabletCell(row_id=row.id, column_id=column_id, value=value))
        else:
            cell.value = value
