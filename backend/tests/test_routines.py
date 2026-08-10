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


def test_update_routine_replaces_name_and_exercises(client: TestClient) -> None:
    exercise_id = client.get("/exercises").json()[0]["id"]
    routine_id = client.post(
        "/routines",
        json={
            "name": "Original",
            "exercises": [
                {"exercise_id": exercise_id, "target_sets": 3, "target_reps": 10, "order": 0},
            ],
        },
    ).json()["id"]

    response = client.put(
        f"/routines/{routine_id}",
        json={
            "name": "Renamed",
            "exercises": [
                {"exercise_id": exercise_id, "target_sets": 5, "target_reps": 5, "order": 0},
                {"exercise_id": exercise_id, "target_sets": 4, "target_reps": 8, "order": 1},
            ],
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["id"] == routine_id
    assert body["name"] == "Renamed"
    assert len(body["exercises"]) == 2
    assert body["exercises"][0]["target_sets"] == 5

    refetched = client.get(f"/routines/{routine_id}").json()
    assert refetched == body


def test_update_unknown_routine_is_404(client: TestClient) -> None:
    response = client.put("/routines/9999", json={"name": "Nope", "exercises": []})

    assert response.status_code == 404


def test_update_routine_with_unknown_exercise_is_404(client: TestClient) -> None:
    routine_id = client.get("/routines").json()[0]["id"]

    response = client.put(
        f"/routines/{routine_id}",
        json={"name": "Bad", "exercises": [{"exercise_id": 9999, "target_sets": 3, "target_reps": 10, "order": 0}]},
    )

    assert response.status_code == 404


def test_delete_routine(client: TestClient) -> None:
    exercise_id = client.get("/exercises").json()[0]["id"]
    routine_id = client.post(
        "/routines",
        json={
            "name": "To delete",
            "exercises": [
                {"exercise_id": exercise_id, "target_sets": 3, "target_reps": 10, "order": 0},
            ],
        },
    ).json()["id"]

    response = client.delete(f"/routines/{routine_id}")

    assert response.status_code == 204
    assert response.content == b""
    assert client.get(f"/routines/{routine_id}").status_code == 404


def test_delete_unknown_routine_is_404(client: TestClient) -> None:
    response = client.delete("/routines/9999")

    assert response.status_code == 404


def test_delete_routine_assigned_to_a_day_clears_the_day_to_null(client: TestClient) -> None:
    exercise_id = client.get("/exercises").json()[0]["id"]
    routine_id = client.post(
        "/routines",
        json={
            "name": "Scheduled routine",
            "exercises": [
                {"exercise_id": exercise_id, "target_sets": 3, "target_reps": 10, "order": 0},
            ],
        },
    ).json()["id"]
    client.put("/schedule/3", json={"routine_id": routine_id})

    response = client.delete(f"/routines/{routine_id}")

    assert response.status_code == 204

    schedule = {entry["day"]: entry["routine_id"] for entry in client.get("/schedule").json()}
    assert schedule[3] is None
