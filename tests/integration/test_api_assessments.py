from __future__ import annotations

from datetime import timedelta

from valhalla.db.base import now

SLUG = "burns-depression"


def answers(client, value=0, **overrides):
    instrument = client.get(f"/api/assessments/{SLUG}").json()
    given = {
        question["key"]: value
        for section in instrument["sections"]
        for question in section["questions"]
    }
    given.update(overrides)
    return given


def take(client, value=0, when=None, note="", **overrides):
    payload = {"answers": answers(client, value, **overrides), "note": note}
    if when is not None:
        payload["taken_at"] = when.isoformat()
    response = client.post(f"/api/assessments/{SLUG}/attempts", json=payload)
    assert response.status_code == 201, response.text
    return response.json()


def test_the_shelf_lists_the_checklist(client):
    shelf = client.get("/api/assessments").json()

    assert [item["slug"] for item in shelf] == [SLUG]
    assert shelf[0]["question_count"] == 25
    assert shelf[0]["max_score"] == 100
    assert shelf[0]["attempts"] == 0
    assert shelf[0]["latest"] is None


def test_the_checklist_comes_with_its_parts(client):
    instrument = client.get(f"/api/assessments/{SLUG}").json()

    assert len(instrument["choices"]) == 5
    assert len(instrument["bands"]) == 6
    assert sum(len(section["questions"]) for section in instrument["sections"]) == 25

    alarming = [
        question["key"]
        for section in instrument["sections"]
        for question in section["questions"]
        if question["alarming"]
    ]
    assert alarming == ["plan"]


def test_the_checklist_answers_in_english_too(client):
    english = client.get(f"/api/assessments/{SLUG}", params={"language": "en"}).json()

    assert english["title"] == "Burns Depression Checklist"


def test_an_unknown_checklist_is_a_404(client):
    assert client.get("/api/assessments/saga-of-nothing").status_code == 404


def test_an_attempt_is_recorded_and_summed(client):
    attempt = take(client, 1, note="Тяжёлая неделя")

    assert attempt["score"] == 25
    assert attempt["band"] == "mild"
    assert attempt["note"] == "Тяжёлая неделя"
    assert len(attempt["sections"]) == 4

    shelf = client.get("/api/assessments").json()
    assert shelf[0]["attempts"] == 1
    assert shelf[0]["latest"]["score"] == 25


def test_a_half_filled_checklist_is_refused(client):
    given = answers(client, 1)
    given.pop("guilt")

    response = client.post(f"/api/assessments/{SLUG}/attempts", json={"answers": given})

    assert response.status_code == 422
    assert "guilt" in response.json()["detail"]


def test_a_plan_comes_back_with_a_warning(client):
    attempt = take(client, 0, plan=2)

    assert attempt["alarming"] is True
    assert attempt["alarm"]


def test_dark_thoughts_without_a_plan_stay_quiet(client):
    attempt = take(client, 0, suicidal_thoughts=3, wish_to_die=3)

    assert attempt["alarming"] is False
    assert attempt["alarm"] == ""


def test_attempts_can_be_asked_for_by_stretch(client):
    moment = now()
    take(client, 1, when=moment - timedelta(days=60))
    take(client, 3, when=moment - timedelta(days=1))

    everything = client.get(f"/api/assessments/{SLUG}/attempts").json()
    recent = client.get(
        f"/api/assessments/{SLUG}/attempts",
        params={"since": (moment - timedelta(days=30)).isoformat()},
    ).json()

    assert [item["score"] for item in everything] == [25, 75]
    assert [item["score"] for item in recent] == [75]


def test_an_attempt_can_be_read_back(client):
    stored = take(client, 0, sadness=4)

    read = client.get(f"/api/assessments/attempts/{stored['id']}").json()
    thoughts = next(section for section in read["sections"] if section["key"] == "thoughts")

    assert read["score"] == 4
    assert thoughts["score"] == 4
    assert thoughts["answers"][0]["value"] == 4
    assert thoughts["answers"][0]["label"]


def test_an_attempt_can_be_erased(client):
    stored = take(client, 1)

    assert client.delete(f"/api/assessments/attempts/{stored['id']}").status_code == 204
    assert client.get(f"/api/assessments/{SLUG}/attempts").json() == []
    assert client.get(f"/api/assessments/attempts/{stored['id']}").status_code == 404
