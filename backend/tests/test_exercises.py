from fastapi.testclient import TestClient


def test_list_exercises_returns_seeded_data(client: TestClient) -> None:
    response = client.get("/exercises")

    assert response.status_code == 200
    names = {e["name"] for e in response.json()}
    assert "Press banca" in names


def test_create_exercise(client: TestClient) -> None:
    response = client.post("/exercises", json={"name": "Curl biceps", "unit": "kg"})

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Curl biceps"
    assert body["id"] > 0

    listed = client.get("/exercises").json()
    assert any(e["id"] == body["id"] for e in listed)


def test_progress_for_unknown_exercise_is_404(client: TestClient) -> None:
    response = client.get("/exercises/9999/progress")

    assert response.status_code == 404


def test_progress_empty_for_exercise_with_no_workouts(client: TestClient) -> None:
    exercises = client.get("/exercises").json()
    exercise_id = exercises[0]["id"]

    response = client.get(f"/exercises/{exercise_id}/progress")

    assert response.status_code == 200
    assert response.json()["points"] == []
