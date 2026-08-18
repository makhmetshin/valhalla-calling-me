from __future__ import annotations

from valhalla.schemas.codex import CodexChapterCreate, CodexEntryCreate
from valhalla.schemas.tablets import (
    TabletColumnWrite,
    TabletKindCreate,
    TabletPageCreate,
    TabletPageUpdate,
    TabletRowWrite,
)
from valhalla.services import codex as codex_service
from valhalla.services import export as service
from valhalla.services import media as media_service
from valhalla.services import tablets as tablet_service


def build_codex(session):
    root = codex_service.create_chapter(
        session, CodexChapterCreate(title="Путь", summary="О дороге")
    )
    nested = codex_service.create_chapter(
        session, CodexChapterCreate(title="Тени", parent_id=root.id)
    )
    codex_service.create_entry(
        session, CodexEntryCreate(chapter_id=root.id, title="Первый шаг", body="Держись.")
    )
    codex_service.create_entry(
        session, CodexEntryCreate(chapter_id=nested.id, title="Ночь", body="Темно.")
    )
    return root, nested


def build_tablet(session, title="Дневник мыслей"):
    kind = tablet_service.create_kind(
        session,
        TabletKindCreate(
            title=title,
            summary="ABC-разбор",
            columns=[TabletColumnWrite(title="Ситуация"), TabletColumnWrite(title="Чувство")],
        ),
    )
    page = tablet_service.create_page(
        session,
        TabletPageCreate(kind_id=kind.id, title="Неделя 1", purpose="Ловлю триггеры"),
    )
    columns = [column.id for column in kind.columns]
    tablet_service.save_page(
        session,
        page.id,
        TabletPageUpdate(
            rows=[
                TabletRowWrite(
                    id=page.rows[0].id, cells={columns[0]: "Звонок", columns[1]: "Тревога"}
                )
            ]
        ),
    )
    return kind


def test_codex_lands_in_one_file(session, settings):
    build_codex(session)

    written = service.export_codex(session)
    body = (settings.vault_dir / written.path).read_text(encoding="utf-8")

    assert written.path == "exports/codex.md"
    assert body.startswith("# Кодекс")
    assert "глав: 2 · страниц: 2" in body
    assert "## Путь" in body
    assert "### Первый шаг" in body
    assert "### Тени" in body
    assert "#### Ночь" in body
    assert "Держись." in body
    assert "> О дороге" in body


def test_codex_export_points_at_the_pictures(session, settings, png_bytes):
    root, _ = build_codex(session)
    asset = media_service.store_upload(session, "рассвет.png", png_bytes, "Рассвет")
    codex_service.create_entry(
        session,
        CodexEntryCreate(chapter_id=root.id, title="С картинкой", image_ids=[asset.id]),
    )

    written = service.export_codex(session)
    body = (settings.vault_dir / written.path).read_text(encoding="utf-8")
    link = next(line for line in body.splitlines() if line.startswith("!["))

    assert link.startswith("![Рассвет](")
    target = (settings.exports_dir / link.split("(", 1)[1].rstrip(")")).resolve()
    assert target.is_file()


def test_empty_codex_still_writes_a_file(session, settings):
    written = service.export_codex(session)
    body = (settings.vault_dir / written.path).read_text(encoding="utf-8")

    assert "Кодекс пока пуст." in body


def test_every_kind_gets_its_own_file(session, settings):
    build_tablet(session)
    build_tablet(session, title="Колесо баланса")

    written = service.export_tablets(session)

    assert [item.name for item in written] == ["Дневник мыслей.md", "Колесо баланса.md"]
    assert all((settings.vault_dir / item.path).is_file() for item in written)


def test_tablet_file_holds_a_markdown_table(session, settings):
    build_tablet(session)

    written = service.export_tablets(session)[0]
    body = (settings.vault_dir / written.path).read_text(encoding="utf-8")

    assert body.startswith("# Дневник мыслей")
    assert "ABC-разбор" in body
    assert "## Неделя 1" in body
    assert "> Ловлю триггеры" in body
    assert "| Ситуация | Чувство |" in body
    assert "| --- | --- |" in body
    assert "| Звонок | Тревога |" in body


def test_pipes_and_newlines_do_not_break_the_table(session, settings):
    kind = tablet_service.create_kind(
        session,
        TabletKindCreate(title="Труба", columns=[TabletColumnWrite(title="Что")]),
    )
    page = tablet_service.create_page(session, TabletPageCreate(kind_id=kind.id, title="День"))
    tablet_service.save_page(
        session,
        page.id,
        TabletPageUpdate(
            rows=[
                TabletRowWrite(
                    id=page.rows[0].id, cells={kind.columns[0].id: "первое | второе\nтретье"}
                )
            ]
        ),
    )

    written = service.export_tablets(session)[0]
    body = (settings.vault_dir / written.path).read_text(encoding="utf-8")
    row = next(line for line in body.splitlines() if "первое" in line)

    assert row == "| первое \\| второе третье |"
    assert row.count("|") == 3


def test_kind_without_pages_says_so(session, settings):
    tablet_service.create_kind(
        session,
        TabletKindCreate(title="Пусто", columns=[TabletColumnWrite(title="Раз")]),
    )

    written = service.export_tablets(session)[0]
    body = (settings.vault_dir / written.path).read_text(encoding="utf-8")

    assert "В этом виде скрижалей пока нет страниц." in body


def test_unsafe_titles_become_safe_filenames(session, settings):
    tablet_service.create_kind(
        session,
        TabletKindCreate(title="Дыхание: 4/7/8 <дома>", columns=[TabletColumnWrite(title="Круг")]),
    )

    written = service.export_tablets(session)[0]

    assert "/" not in written.name
    assert ":" not in written.name
    assert (settings.vault_dir / written.path).is_file()


def test_english_export_speaks_english(session, settings):
    build_tablet(session)
    build_codex(session)

    tablet = service.export_tablets(session, "en")[0]
    codex = service.export_codex(session, "en")

    assert "Gathered" in (settings.vault_dir / tablet.path).read_text(encoding="utf-8")
    assert (settings.vault_dir / codex.path).read_text(encoding="utf-8").startswith("# Codex")


def test_nothing_to_export_is_not_an_error(session):
    assert service.export_tablets(session) == []
