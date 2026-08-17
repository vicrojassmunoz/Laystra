from fastapi.testclient import TestClient


def test_list_goals_empty_initially(client: TestClient) -> None:
    response = client.get("/goals")

    assert response.status_code == 200
    assert response.json() == []


def test_create_goal_defaults_done_to_false(client: TestClient) -> None:
    response = client.post(
        "/goals",
        json={"text": "Bajar a 80kg", "target_value": 80.0, "target_date": "2026-12-31"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] > 0
    assert body["text"] == "Bajar a 80kg"
    assert body["target_value"] == 80.0
    assert body["target_date"] == "2026-12-31"
    assert body["done"] is False

    listed = client.get("/goals").json()
    assert len(listed) == 1
    assert listed[0]["id"] == body["id"]


def test_create_goal_without_optional_fields(client: TestClient) -> None:
    response = client.post("/goals", json={"text": "Entrenar 3 veces por semana"})

    assert response.status_code == 201
    body = response.json()
    assert body["target_value"] is None
    assert body["target_date"] is None
    assert body["done"] is False


def test_update_goal_edits_text_and_target(client: TestClient) -> None:
    create_response = client.post("/goals", json={"text": "Bajar a 80kg", "target_value": 80.0})
    goal_id = create_response.json()["id"]

    update_response = client.put(
        f"/goals/{goal_id}",
        json={"text": "Bajar a 78kg", "target_value": 78.0, "target_date": "2027-01-01", "done": False},
    )

    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["text"] == "Bajar a 78kg"
    assert updated["target_value"] == 78.0
    assert updated["target_date"] == "2027-01-01"
    assert updated["done"] is False


def test_update_goal_toggles_done(client: TestClient) -> None:
    create_response = client.post("/goals", json={"text": "Entrenar 3 veces por semana"})
    goal_id = create_response.json()["id"]

    update_response = client.put(
        f"/goals/{goal_id}",
        json={"text": "Entrenar 3 veces por semana", "target_value": None, "target_date": None, "done": True},
    )

    assert update_response.status_code == 200
    assert update_response.json()["done"] is True

    listed = client.get("/goals").json()
    assert listed[0]["done"] is True


def test_update_unknown_goal_is_404(client: TestClient) -> None:
    response = client.put(
        "/goals/9999",
        json={"text": "x", "target_value": None, "target_date": None, "done": False},
    )

    assert response.status_code == 404


def test_delete_goal(client: TestClient) -> None:
    create_response = client.post("/goals", json={"text": "Bajar a 80kg"})
    goal_id = create_response.json()["id"]

    delete_response = client.delete(f"/goals/{goal_id}")
    assert delete_response.status_code == 204
    assert delete_response.content == b""

    listed = client.get("/goals").json()
    assert listed == []


def test_delete_unknown_goal_is_404(client: TestClient) -> None:
    response = client.delete("/goals/9999")

    assert response.status_code == 404


def test_create_goal_with_blank_text_is_422(client: TestClient) -> None:
    empty = client.post("/goals", json={"text": ""})
    whitespace_only = client.post("/goals", json={"text": "   "})

    assert empty.status_code == 422
    assert whitespace_only.status_code == 422


def test_create_goal_with_negative_target_value_is_422(client: TestClient) -> None:
    response = client.post("/goals", json={"text": "Bajar de peso", "target_value": -1})

    assert response.status_code == 422


def test_update_goal_with_blank_text_is_422(client: TestClient) -> None:
    create_response = client.post("/goals", json={"text": "Bajar a 80kg"})
    goal_id = create_response.json()["id"]

    response = client.put(
        f"/goals/{goal_id}",
        json={"text": "   ", "target_value": None, "target_date": None, "done": False},
    )

    assert response.status_code == 422
