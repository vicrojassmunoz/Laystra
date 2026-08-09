from fastapi.testclient import TestClient


def test_list_routines_returns_seeded_data(client: TestClient) -> None:
    response = client.get("/routines")

    assert response.status_code == 200
    names = {r["name"] for r in response.json()}
    assert {"Push day", "Pierna"} <= names


def test_create_routine_with_exercises_in_one_call(client: TestClient) -> None:
    exercise_id = client.get("/exercises").json()[0]["id"]

    response = client.post(
        "/routines",
        json={
            "name": "Full body",
            "exercises": [
                {"exercise_id": exercise_id, "target_sets": 3, "target_reps": 10, "order": 0},
            ],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Full body"
    assert len(body["exercises"]) == 1
    assert body["exercises"][0]["exercise_id"] == exercise_id


def test_create_routine_with_unknown_exercise_is_404(client: TestClient) -> None:
    response = client.post(
        "/routines",
        json={"name": "Bad routine", "exercises": [{"exercise_id": 9999, "target_sets": 3, "target_reps": 10, "order": 0}]},
    )

    assert response.status_code == 404


def test_get_routine_by_id(client: TestClient) -> None:
    routine_id = client.get("/routines").json()[0]["id"]

    response = client.get(f"/routines/{routine_id}")

    assert response.status_code == 200
    assert response.json()["id"] == routine_id


def test_get_unknown_routine_is_404(client: TestClient) -> None:
    response = client.get("/routines/9999")

    assert response.status_code == 404
