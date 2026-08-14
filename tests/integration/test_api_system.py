from __future__ import annotations

from datetime import date


def test_the_hall_reports_itself(client):
    overview = client.get("/api/overview").json()

    assert overview["today"] == date.today().isoformat()
    assert {"total", "unlocked"} <= set(overview["achievements"])
    assert overview["due_reminders"] >= 0


def test_the_codex_arrives_seeded(client):
    outline = client.get("/api/codex/outline").json()

    assert outline
    assert all(chapter["title"] for chapter in outline)
    assert any(chapter["entries"] for chapter in outline)


def test_a_chapter_and_a_page_can_be_written(client):
    chapter = client.post("/api/codex/chapters", json={"title": "Мой путь"}).json()
    entry = client.post(
        "/api/codex/entries",
        json={"chapter_id": chapter["id"], "title": "Первый шаг", "body": "Держись."},
    ).json()

    found = client.get(f"/api/codex/entries/{entry['id']}").json()
    searched = client.get("/api/codex/search?q=Держись").json()

    assert found["body"] == "Держись."
    assert [item["title"] for item in searched] == ["Первый шаг"]


def test_preferences_hold_and_let_go(client):
    stored = client.put(
        "/api/preferences", json={"values": {"player.volume": 0.25, "ui.language": "en"}}
    ).json()

    assert stored["player.volume"] == 0.25
    assert stored["ui.language"] == "en"

    reset = client.post("/api/preferences/reset?keys=ui.language").json()

    assert reset["ui.language"] == "ru"
    assert reset["player.volume"] == 0.25


def test_presets_are_served_and_registered(client):
    images = client.get("/api/media?kind=image").json()
    icons = [item for item in images if item["collection"] == "icons"]

    assert icons
    assert all(item["url"].startswith("/presets/") for item in icons)
    assert client.get(icons[0]["url"]).status_code == 200


def test_the_dropped_presets_are_really_gone(client):
    images = client.get("/api/media?kind=image").json()
    names = [item["relative_path"] for item in images]

    assert not [name for name in names if "valknut" in name or "dragon-head" in name]
    assert client.get("/presets/icons/valknut.svg").status_code == 404
    assert any(name.endswith("icons/north-star.svg") for name in names)


def test_a_metric_moves_and_keeps_its_history(client):
    metric = client.post("/api/metrics", json={"name": "Выходы", "unit": "раз", "step": 1.0}).json()

    adjusted = client.post(f"/api/metrics/{metric['id']}/adjust", json={"delta": 2.0})
    history = client.get(f"/api/metrics/{metric['id']}/history").json()
    listed = {item["id"]: item for item in client.get("/api/metrics").json()}

    assert adjusted.status_code == 200, adjusted.text
    assert listed[metric["id"]]["value"] == 2.0
    assert [entry["delta"] for entry in history] == [2.0]


def test_a_vault_summary_is_offered(client):
    vault = client.get("/api/vault").json()

    assert "media_bytes" in vault
    assert set(vault["media_bytes"]) >= {"image", "audio"}


def test_a_missing_thing_answers_politely(client):
    response = client.get("/api/tablets/pages/404")

    assert response.status_code == 404
    assert "detail" in response.json()


def test_a_video_can_be_kept_as_a_background(client, settings):
    (settings.video_dir / "aurora.mp4").write_bytes(bytes.fromhex("0000001866747970"))
    client.post("/api/vault/scan")

    video = next(
        item for item in client.get("/api/media?kind=video").json() if item["title"] == "aurora"
    )
    stored = client.put(
        "/api/preferences",
        json={
            "values": {
                "backgrounds": {
                    "dashboard": {
                        "kind": "video",
                        "media_id": video["id"],
                        "url": video["url"],
                        "dim": 0.7,
                        "blur": 0,
                    }
                }
            }
        },
    ).json()

    assert video["url"] == "/vault/video/aurora.mp4"
    assert client.get(video["url"]).status_code == 200
    assert stored["backgrounds"]["dashboard"]["kind"] == "video"
    assert (
        client.get("/api/preferences").json()["backgrounds"]["dashboard"]["media_id"] == video["id"]
    )
