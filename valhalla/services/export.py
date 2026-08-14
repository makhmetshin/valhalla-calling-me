from __future__ import annotations

import os
import re
from datetime import datetime
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from valhalla.config import get_settings
from valhalla.media_paths import absolute_path
from valhalla.models import (
    CodexChapter,
    CodexEntry,
    MediaAsset,
    TabletColumn,
    TabletKind,
    TabletPage,
)
from valhalla.schemas.export import ExportedFile

__all__ = ["export_codex", "export_tablets"]

MAX_HEADING = 6
UNSAFE_NAME = re.compile(r"[^\w \-.]+", re.UNICODE)

LABELS: dict[str, dict[str, str]] = {
    "ru": {
        "codex": "Кодекс",
        "codex_stamp": "Собрано {when} · глав: {chapters} · страниц: {entries}",
        "codex_empty": "Кодекс пока пуст.",
        "tablet_stamp": "Собрано {when} · страниц: {pages}",
        "tablet_empty": "В этом виде скрижалей пока нет страниц.",
        "rows_empty": "Строк пока нет.",
        "nameless": "без имени",
    },
    "en": {
        "codex": "Codex",
        "codex_stamp": "Gathered {when} · chapters: {chapters} · pages: {entries}",
        "codex_empty": "The codex is still empty.",
        "tablet_stamp": "Gathered {when} · pages: {pages}",
        "tablet_empty": "This kind of tablet has no pages yet.",
        "rows_empty": "No rows yet.",
        "nameless": "unnamed",
    },
}


def export_codex(session: Session, language: str = "ru") -> ExportedFile:
    words = _labels(language)
    roots = list(
        session.execute(
            select(CodexChapter)
            .where(CodexChapter.parent_id.is_(None))
            .order_by(CodexChapter.position, CodexChapter.id)
        ).scalars()
    )
    target = _exports_dir() / "codex.md"

    chapters, entries = _codex_weight(roots)
    lines = [
        f"# {words['codex']}",
        "",
        f"_{words['codex_stamp'].format(when=_stamp(), chapters=chapters, entries=entries)}_",
        "",
    ]
    if not roots:
        lines.append(words["codex_empty"])
    for chapter in roots:
        lines.extend(_chapter_lines(chapter, 2, target.parent))

    return _write(target, lines)


def export_tablets(session: Session, language: str = "ru") -> list[ExportedFile]:
    words = _labels(language)
    kinds = list(
        session.execute(select(TabletKind).order_by(TabletKind.position, TabletKind.id)).scalars()
    )
    directory = _exports_dir() / "tablets"
    directory.mkdir(parents=True, exist_ok=True)

    used: set[str] = set()
    written: list[ExportedFile] = []
    for kind in kinds:
        name = _unique_name(_safe_name(kind.title, words["nameless"]), kind.id, used)
        written.append(_write(directory / f"{name}.md", _tablet_lines(session, kind, words)))
    return written


def _tablet_lines(session: Session, kind: TabletKind, words: dict[str, str]) -> list[str]:
    pages = list(
        session.execute(
            select(TabletPage)
            .where(TabletPage.kind_id == kind.id)
            .order_by(TabletPage.position, TabletPage.id)
        ).scalars()
    )

    lines = [f"# {kind.title}", ""]
    if kind.summary.strip():
        lines.extend([kind.summary.strip(), ""])
    lines.extend([f"_{words['tablet_stamp'].format(when=_stamp(), pages=len(pages))}_", ""])

    if not pages:
        lines.extend([words["tablet_empty"], ""])
        return lines

    columns = list(kind.columns)
    for page in pages:
        lines.append(f"## {page.title}")
        lines.append("")
        if page.purpose.strip():
            lines.extend([f"> {line}" for line in page.purpose.strip().splitlines()])
            lines.append("")
        lines.extend(_table_lines(page, columns, words))
        lines.append("")
    return lines


def _table_lines(page: TabletPage, columns: list[TabletColumn], words: dict[str, str]) -> list[str]:
    if not columns:
        return [words["rows_empty"]]

    header = "| " + " | ".join(_cell(column.title) for column in columns) + " |"
    divider = "| " + " | ".join("---" for _ in columns) + " |"
    lines = [header, divider]

    for row in page.rows:
        values = {cell.column_id: cell.value for cell in row.cells}
        lines.append(
            "| " + " | ".join(_cell(values.get(column.id, "")) for column in columns) + " |"
        )
    if not page.rows:
        lines.append("| " + " | ".join("" for _ in columns) + " |")
    return lines


def _chapter_lines(chapter: CodexChapter, depth: int, base: Path) -> list[str]:
    level = min(depth, MAX_HEADING)
    lines = [f"{'#' * level} {chapter.title}", ""]
    if chapter.summary.strip():
        lines.extend([f"> {line}" for line in chapter.summary.strip().splitlines()])
        lines.append("")
    for entry in chapter.entries:
        lines.extend(_entry_lines(entry, level + 1, base))
    for child in chapter.children:
        lines.extend(_chapter_lines(child, depth + 1, base))
    return lines


def _entry_lines(entry: CodexEntry, depth: int, base: Path) -> list[str]:
    lines = [f"{'#' * min(depth, MAX_HEADING)} {entry.title}", ""]
    if entry.cover:
        lines.extend([_image(entry.cover, base), ""])
    if entry.body.strip():
        lines.extend([entry.body.strip(), ""])
    for image in entry.images:
        lines.extend([_image(image, base), ""])
    return lines


def _image(asset: MediaAsset, base: Path) -> str:
    return f"![{_cell(asset.title)}]({_relative(asset, base)})"


def _relative(asset: MediaAsset, base: Path) -> str:
    path = absolute_path(asset.kind, asset.origin, asset.relative_path)
    try:
        return Path(os.path.relpath(path, base)).as_posix()
    except ValueError:
        return path.as_posix()


def _codex_weight(chapters: list[CodexChapter]) -> tuple[int, int]:
    total_chapters = 0
    total_entries = 0
    for chapter in chapters:
        total_chapters += 1
        total_entries += len(chapter.entries)
        nested_chapters, nested_entries = _codex_weight(chapter.children)
        total_chapters += nested_chapters
        total_entries += nested_entries
    return total_chapters, total_entries


def _cell(value: str) -> str:
    return " ".join(str(value or "").replace("|", "\\|").splitlines()).strip()


def _safe_name(title: str, fallback: str) -> str:
    cleaned = UNSAFE_NAME.sub(" ", title).strip().strip(".")
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned[:80] or fallback


def _unique_name(name: str, entity_id: int, used: set[str]) -> str:
    candidate = name if name.lower() not in used else f"{name} {entity_id}"
    used.add(candidate.lower())
    return candidate


def _labels(language: str) -> dict[str, str]:
    return LABELS.get(language, LABELS["ru"])


def _stamp() -> str:
    return datetime.now().strftime("%d.%m.%Y %H:%M")


def _exports_dir() -> Path:
    settings = get_settings()
    settings.exports_dir.mkdir(parents=True, exist_ok=True)
    return settings.exports_dir


def _write(target: Path, lines: list[str]) -> ExportedFile:
    text = "\n".join(lines).rstrip() + "\n"
    target.write_text(text, encoding="utf-8")
    settings = get_settings()
    return ExportedFile(
        name=target.name,
        path=target.relative_to(settings.vault_dir).as_posix(),
        size_bytes=target.stat().st_size,
    )
