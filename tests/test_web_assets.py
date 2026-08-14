from __future__ import annotations

import re
from pathlib import Path
from xml.etree import ElementTree

import pytest

from valhalla.models.enums import EntityKind, MediaKind, ReminderCadence, TaskState

PROJECT_ROOT = Path(__file__).resolve().parents[1]
WEB = PROJECT_ROOT / "web"
PRESETS = WEB / "presets"
SCRIPTS = sorted((WEB / "assets" / "js").rglob("*.js"))
STYLES = sorted((WEB / "assets" / "css").glob("*.css"))

KEY_LINE = re.compile(r"^  '([^']+)':", re.M)
TRANSLATION_CALL = re.compile(r"(?<![\w.])t\(\s*'([^']+)'")
ROUTE_LINE = re.compile(r"name:\s*'([^']+)',\s*title:.*?icon:\s*'([^']+)'")
ASSET_REFERENCE = re.compile(r"/presets/(icons|glyphs|backgrounds)/([\w.-]+\.svg)")
COLLECTION_LINE = re.compile(r"COLLECTION_KEYS = \[([^\]]+)\]")


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def catalogues() -> tuple[dict[str, str], dict[str, str]]:
    source = read(WEB / "assets" / "js" / "core" / "i18n.js")
    russian, english = source.split("const EN = {")
    return (
        {key: "" for key in KEY_LINE.findall(russian)},
        {key: "" for key in KEY_LINE.findall(english)},
    )


def test_both_tongues_know_the_same_words():
    russian, english = catalogues()

    assert set(russian) == set(english)


def test_no_word_is_written_twice():
    source = read(WEB / "assets" / "js" / "core" / "i18n.js")
    russian, english = source.split("const EN = {")

    for block, name in ((russian, "ru"), (english, "en")):
        keys = KEY_LINE.findall(block)
        repeated = sorted({key for key in keys if keys.count(key) > 1})
        assert not repeated, f"{name} repeats: {repeated}"


def test_every_asked_word_exists():
    russian, _ = catalogues()
    missing = set()

    for script in SCRIPTS:
        for key in TRANSLATION_CALL.findall(read(script)):
            if key not in russian:
                missing.add(f"{script.name}: {key}")

    assert not missing


def test_the_catalogue_carries_no_dead_weight():
    russian, _ = catalogues()
    sources = "\n".join(read(script) for script in SCRIPTS if script.name != "i18n.js")
    families = ("kind.", "cadence.", "state.", "collection.", "nav.", "theme.")

    unused = {key for key in russian if not key.startswith(families) and f"'{key}'" not in sources}

    assert not unused


@pytest.mark.parametrize(
    ("prefix", "values"),
    [
        ("kind", [str(item) for item in EntityKind]),
        ("cadence", [str(item) for item in ReminderCadence]),
        ("state", [str(item) for item in TaskState]),
    ],
)
def test_enums_are_translated(prefix, values):
    russian, english = catalogues()

    for value in values:
        assert f"{prefix}.{value}" in russian
        assert f"{prefix}.{value}" in english


def test_media_collections_are_translated():
    russian, _ = catalogues()
    listed = COLLECTION_LINE.search(read(WEB / "assets" / "js" / "core" / "format.js"))

    for name in re.findall(r"'([^']+)'", listed.group(1)):
        assert f"collection.{name}" in russian


def test_every_page_has_a_name_and_a_glyph():
    routes = ROUTE_LINE.findall(read(WEB / "assets" / "js" / "main.js"))
    russian, english = catalogues()

    assert len(routes) >= 9
    for name, icon in routes:
        assert f"nav.{name}" in russian
        assert f"nav.{name}" in english
        assert (PRESETS / "glyphs" / f"{icon}.svg").is_file()


def test_the_sigil_glyph_exists():
    style = read(WEB / "assets" / "css" / "layout.css")
    sigil = style.split(".sigil .glyph")[1].split("}")[0]
    name = ASSET_REFERENCE.search(sigil)

    assert name is not None
    assert (PRESETS / name.group(1) / name.group(2)).is_file()


def test_nothing_points_at_a_missing_preset():
    missing = set()

    for source in SCRIPTS + STYLES + [WEB / "index.html"]:
        for folder, name in ASSET_REFERENCE.findall(read(source)):
            if not (PRESETS / folder / name).is_file():
                missing.add(f"{source.name}: {folder}/{name}")

    assert not missing


def test_every_icon_has_a_glyph_twin():
    icons = {path.name for path in (PRESETS / "icons").glob("*.svg")}
    glyphs = {path.name for path in (PRESETS / "glyphs").glob("*.svg")}

    assert icons == glyphs


def test_the_generator_wrote_what_it_promises():
    from tools.generate_presets import BACKGROUNDS, ICONS

    for name in ICONS:
        assert (PRESETS / "icons" / f"{name}.svg").is_file()
        assert (PRESETS / "glyphs" / f"{name}.svg").is_file()
    for name in BACKGROUNDS:
        assert (PRESETS / "backgrounds" / f"{name}.svg").is_file()


def test_every_preset_is_a_readable_drawing():
    for path in sorted(PRESETS.rglob("*.svg")):
        root = ElementTree.fromstring(read(path))
        assert root.tag.endswith("svg")
        assert root.get("viewBox")


def test_the_page_loads_only_files_that_exist():
    markup = read(WEB / "index.html")

    for reference in re.findall(r'(?:href|src)="(/assets/[^"]+)"', markup):
        assert (WEB / reference.lstrip("/")).is_file()


def test_media_kinds_have_a_home():
    from valhalla.media_paths import KIND_DIRECTORIES

    assert set(KIND_DIRECTORIES) == set(MediaKind)
