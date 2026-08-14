from __future__ import annotations

import pytest

from valhalla.models import TabletCell, TabletKind, TabletPage, TabletRow
from valhalla.schemas.tablets import (
    TabletColumnWrite,
    TabletKindCreate,
    TabletKindUpdate,
    TabletPageCreate,
    TabletPageUpdate,
    TabletRowWrite,
)
from valhalla.services import tablets as service
from valhalla.services.errors import NotFoundError, ValidationError


def make_kind(session, title="Дневник мыслей", columns=("Ситуация", "Мысль", "Чувство")):
    return service.create_kind(
        session,
        TabletKindCreate(
            title=title,
            summary="ABC-разбор",
            columns=[TabletColumnWrite(title=name) for name in columns],
        ),
    )


def make_page(session, kind_id, title="Неделя 1"):
    return service.create_page(
        session, TabletPageCreate(kind_id=kind_id, title=title, purpose="Ловлю триггеры")
    )


def test_kind_keeps_column_order(session):
    kind = make_kind(session)

    assert [column.title for column in kind.columns] == ["Ситуация", "Мысль", "Чувство"]
    assert [column.position for column in kind.columns] == [0, 1, 2]
    assert kind.page_count == 0


def test_kinds_are_listed_in_their_own_order(session):
    make_kind(session, title="Первый", columns=("Раз",))
    make_kind(session, title="Второй", columns=("Два",))

    assert [kind.title for kind in service.list_kinds(session)] == ["Первый", "Второй"]


def test_page_starts_with_one_empty_row(session):
    kind = make_kind(session)
    page = make_page(session, kind.id)

    assert page.purpose == "Ловлю триггеры"
    assert len(page.rows) == 1
    assert page.rows[0].cells == {}
    assert service.list_kinds(session)[0].page_count == 1


def test_saving_a_page_replaces_rows_and_keeps_identity(session):
    kind = make_kind(session)
    page = make_page(session, kind.id)
    columns = [column.id for column in kind.columns]

    saved = service.save_page(
        session,
        page.id,
        TabletPageUpdate(
            rows=[
                TabletRowWrite(id=page.rows[0].id, cells={columns[0]: "Звонок"}),
                TabletRowWrite(cells={columns[0]: "Прогулка", columns[2]: "Покой"}),
            ]
        ),
    )

    assert saved.rows[0].id == page.rows[0].id
    assert saved.rows[0].cells[columns[0]] == "Звонок"
    assert saved.rows[1].cells[columns[2]] == "Покой"
    assert columns[1] not in saved.rows[1].cells

    trimmed = service.save_page(
        session,
        page.id,
        TabletPageUpdate(rows=[TabletRowWrite(id=saved.rows[1].id, cells={})]),
    )

    assert len(trimmed.rows) == 1
    assert trimmed.rows[0].cells[columns[0]] == "Прогулка"


def test_unknown_columns_are_ignored_when_saving(session):
    kind = make_kind(session)
    page = make_page(session, kind.id)

    saved = service.save_page(
        session,
        page.id,
        TabletPageUpdate(rows=[TabletRowWrite(id=page.rows[0].id, cells={9999: "мимо"})]),
    )

    assert saved.rows[0].cells == {}


def test_renaming_a_column_keeps_the_written_cells(session):
    kind = make_kind(session)
    page = make_page(session, kind.id)
    columns = [column.id for column in kind.columns]
    service.save_page(
        session,
        page.id,
        TabletPageUpdate(
            rows=[
                TabletRowWrite(
                    id=page.rows[0].id,
                    cells={columns[0]: "Звонок", columns[1]: "Не справлюсь"},
                )
            ]
        ),
    )

    grown = service.update_kind(
        session,
        kind.id,
        TabletKindUpdate(
            columns=[
                TabletColumnWrite(id=columns[0], title="Ситуация дня"),
                TabletColumnWrite(id=columns[2], title="Чувство"),
                TabletColumnWrite(title="Ответ себе"),
            ]
        ),
    )

    assert [column.title for column in grown.columns] == ["Ситуация дня", "Чувство", "Ответ себе"]

    kept = service.get_page(session, page.id)
    assert kept.rows[0].cells[columns[0]] == "Звонок"
    assert columns[1] not in kept.rows[0].cells
    assert session.query(TabletCell).count() == 1


def test_a_kind_cannot_lose_every_column(session):
    kind = make_kind(session)

    with pytest.raises(ValidationError):
        service.update_kind(session, kind.id, TabletKindUpdate(columns=[]))


def test_page_needs_columns_to_exist(session):
    made = make_kind(session, columns=("Одна",))
    kind = session.get(TabletKind, made.id)
    for column in list(kind.columns):
        session.delete(column)
    session.flush()
    session.refresh(kind)

    with pytest.raises(ValidationError):
        make_page(session, kind.id)


def test_adding_a_row_appends_to_the_end(session):
    kind = make_kind(session)
    page = make_page(session, kind.id)
    columns = [column.id for column in kind.columns]
    service.save_page(
        session,
        page.id,
        TabletPageUpdate(rows=[TabletRowWrite(id=page.rows[0].id, cells={columns[0]: "Первая"})]),
    )

    grown = service.add_row(session, page.id)

    assert len(grown.rows) == 2
    assert grown.rows[0].cells[columns[0]] == "Первая"
    assert grown.rows[1].cells == {}
    assert grown.rows[1].position == 1


def test_deleting_a_kind_takes_its_pages_along(session):
    kind = make_kind(session)
    page = make_page(session, kind.id)
    columns = [column.id for column in kind.columns]
    service.save_page(
        session,
        page.id,
        TabletPageUpdate(rows=[TabletRowWrite(id=page.rows[0].id, cells={columns[0]: "Звонок"})]),
    )

    service.delete_kind(session, kind.id)

    assert service.list_kinds(session) == []
    assert session.query(TabletPage).count() == 0
    assert session.query(TabletRow).count() == 0
    assert session.query(TabletCell).count() == 0


def test_missing_page_is_reported(session):
    with pytest.raises(NotFoundError):
        service.get_page(session, 404)
