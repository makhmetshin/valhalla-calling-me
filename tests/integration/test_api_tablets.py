from __future__ import annotations


def make_kind(client, title="Дневник мыслей", columns=("Ситуация", "Мысль")):
    response = client.post(
        "/api/tablets/kinds",
        json={
            "title": title,
            "summary": "ABC-разбор",
            "columns": [{"title": name} for name in columns],
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_a_kind_can_be_made_and_listed(client):
    kind = make_kind(client)

    listed = client.get("/api/tablets/kinds").json()

    assert [item["title"] for item in listed] == ["Дневник мыслей"]
    assert [column["title"] for column in kind["columns"]] == ["Ситуация", "Мысль"]
    assert listed[0]["page_count"] == 0


def test_a_kind_without_columns_is_refused(client):
    response = client.post("/api/tablets/kinds", json={"title": "Пусто", "columns": []})

    assert response.status_code == 422


def test_a_page_carries_its_rows(client):
    kind = make_kind(client)
    columns = [column["id"] for column in kind["columns"]]

    page = client.post(
        "/api/tablets/pages",
        json={"kind_id": kind["id"], "title": "Неделя 1", "purpose": "Ловлю триггеры"},
    ).json()
    saved = client.patch(
        f"/api/tablets/pages/{page['id']}",
        json={
            "rows": [
                {"id": page["rows"][0]["id"], "cells": {str(columns[0]): "Звонок"}},
                {"cells": {str(columns[1]): "Тревога"}},
            ]
        },
    ).json()

    assert len(saved["rows"]) == 2
    assert saved["rows"][0]["cells"][str(columns[0])] == "Звонок"
    assert client.get(f"/api/tablets/kinds/{kind['id']}/pages").json()[0]["title"] == "Неделя 1"


def test_rows_can_be_added_and_dropped_through_the_api(client):
    kind = make_kind(client)
    page = client.post(
        "/api/tablets/pages", json={"kind_id": kind["id"], "title": "Неделя 1"}
    ).json()

    grown = client.post(f"/api/tablets/pages/{page['id']}/rows").json()
    assert len(grown["rows"]) == 2

    trimmed = client.patch(
        f"/api/tablets/pages/{page['id']}",
        json={"rows": [{"id": grown["rows"][0]["id"], "cells": {}}]},
    ).json()
    assert len(trimmed["rows"]) == 1


def test_a_page_can_be_erased(client):
    kind = make_kind(client)
    page = client.post(
        "/api/tablets/pages", json={"kind_id": kind["id"], "title": "Неделя 1"}
    ).json()

    assert client.delete(f"/api/tablets/pages/{page['id']}").status_code == 204
    assert client.get(f"/api/tablets/pages/{page['id']}").status_code == 404


def test_kinds_can_be_reordered(client):
    first = make_kind(client, title="Первый", columns=("Раз",))
    second = make_kind(client, title="Второй", columns=("Два",))

    reordered = client.post(
        "/api/tablets/kinds/order", json={"ids": [second["id"], first["id"]]}
    ).json()

    assert [item["title"] for item in reordered] == ["Второй", "Первый"]


def test_tablets_and_codex_export_from_the_api(client):
    kind = make_kind(client)
    client.post("/api/tablets/pages", json={"kind_id": kind["id"], "title": "Неделя 1"})

    tablets = client.post("/api/export/tablets?language=ru").json()
    codex = client.post("/api/export/codex?language=ru").json()

    assert [item["name"] for item in tablets["files"]] == ["Дневник мыслей.md"]
    assert tablets["files"][0]["size_bytes"] > 0
    assert codex["files"][0]["path"] == "exports/codex.md"
    assert codex["directory"].endswith("exports")


def test_a_tablet_page_shows_up_in_the_link_catalogue(client):
    kind = make_kind(client)
    client.post("/api/tablets/pages", json={"kind_id": kind["id"], "title": "Неделя 1"})

    catalogue = client.get("/api/links/catalog").json()

    assert [item["label"] for item in catalogue["tablet_kind"]] == ["Дневник мыслей"]
    assert [item["label"] for item in catalogue["tablet_page"]] == ["Неделя 1"]
