from __future__ import annotations


def make_group(client, name="Дом"):
    response = client.post("/api/tasks/groups", json={"name": name, "description": "Что по дому"})
    assert response.status_code == 201, response.text
    return response.json()


def make_task(client, title="Наколоть дров", **extra):
    response = client.post("/api/tasks", json={"title": title, **extra})
    assert response.status_code == 201, response.text
    return response.json()


def test_a_group_can_be_made_and_listed(client):
    group = make_group(client)

    listed = client.get("/api/tasks/groups").json()

    assert [item["name"] for item in listed] == ["Дом"]
    assert listed[0]["id"] == group["id"]


def test_two_groups_cannot_share_a_name(client):
    make_group(client)

    response = client.post("/api/tasks/groups", json={"name": "Дом"})

    assert response.status_code == 409


def test_a_task_remembers_its_group(client):
    group = make_group(client)

    task = make_task(client, group_id=group["id"])

    assert task["group_id"] == group["id"]
    assert client.get("/api/tasks").json()[0]["group_id"] == group["id"]


def test_tasks_can_be_asked_for_by_group(client):
    group = make_group(client)
    make_task(client, "В группе", group_id=group["id"])
    make_task(client, "Сама по себе")

    listed = client.get("/api/tasks", params={"group_id": group["id"]}).json()

    assert [item["title"] for item in listed] == ["В группе"]


def test_a_task_can_be_moved_into_a_group(client):
    group = make_group(client)
    task = make_task(client)

    moved = client.patch(f"/api/tasks/{task['id']}", json={"group_id": group["id"]})

    assert moved.status_code == 200, moved.text
    assert moved.json()["group_id"] == group["id"]


def test_removing_a_group_leaves_its_tasks_alone(client):
    group = make_group(client)
    task = make_task(client, group_id=group["id"])

    assert client.delete(f"/api/tasks/groups/{group['id']}").status_code == 204

    remaining = client.get("/api/tasks").json()
    assert [item["id"] for item in remaining] == [task["id"]]
    assert remaining[0]["group_id"] is None


def test_groups_keep_the_order_they_are_given(client):
    first = make_group(client, "Дом")
    second = make_group(client, "Двор")

    reordered = client.post("/api/tasks/groups/order", json={"ids": [second["id"], first["id"]]})

    assert [item["name"] for item in reordered.json()] == ["Двор", "Дом"]


def test_a_group_can_be_linked_to_other_things(client):
    group = make_group(client)
    task = make_task(client)

    link = client.post(
        "/api/links",
        json={
            "source_kind": "task_group",
            "source_id": group["id"],
            "target_kind": "task",
            "target_id": task["id"],
        },
    )

    assert link.status_code == 201, link.text
    assert link.json()["source"]["label"] == "Дом"
