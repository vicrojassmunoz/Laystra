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
                {"exercise_id": exercise_id, "target_sets": 3, "order": 0},
            ],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Full body"
    assert len(body["exercises"]) == 1
    assert body["exercises"][0]["exercise_id"] == exercise_id


def test_create_routine_with_multiple_exercises_preserves_order(client: TestClient) -> None:
    exercise_ids = [e["id"] for e in client.get("/exercises").json()[:3]]

    response = client.post(
        "/routines",
        json={
            "name": "Full body",
            "exercises": [
                {"exercise_id": exercise_ids[0], "target_sets": 3, "order": 0},
                {"exercise_id": exercise_ids[1], "target_sets": 4, "order": 1},
                {"exercise_id": exercise_ids[2], "target_sets": 5, "order": 2},
            ],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert [e["order"] for e in body["exercises"]] == [0, 1, 2]


def test_non_positive_target_sets_is_rejected(client: TestClient) -> None:
    exercise_id = client.get("/exercises").json()[0]["id"]

    response = client.post(
        "/routines",
        json={
            "name": "Bad target",
            "exercises": [
                {"exercise_id": exercise_id, "target_sets": 0, "order": 0},
            ],
        },
    )

    assert response.status_code == 422


def test_create_routine_with_unknown_exercise_is_404(client: TestClient) -> None:
    response = client.post(
        "/routines",
        json={"name": "Bad routine", "exercises": [{"exercise_id": 9999, "target_sets": 3, "order": 0}]},
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
                {"exercise_id": exercise_id, "target_sets": 3, "order": 0},
            ],
        },
    ).json()["id"]

    response = client.put(
        f"/routines/{routine_id}",
        json={
            "name": "Renamed",
            "exercises": [
                {"exercise_id": exercise_id, "target_sets": 5, "order": 0},
                {"exercise_id": exercise_id, "target_sets": 4, "order": 1},
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
        json={"name": "Bad", "exercises": [{"exercise_id": 9999, "target_sets": 3, "order": 0}]},
    )

    assert response.status_code == 404


def test_delete_routine(client: TestClient) -> None:
    exercise_id = client.get("/exercises").json()[0]["id"]
    routine_id = client.post(
        "/routines",
        json={
            "name": "To delete",
            "exercises": [
                {"exercise_id": exercise_id, "target_sets": 3, "order": 0},
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


def test_create_routine_with_superset_group_of_three_persists_and_reads_back(client: TestClient) -> None:
    exercise_ids = [e["id"] for e in client.get("/exercises").json()[:3]]

    response = client.post(
        "/routines",
        json={
            "name": "Super-serie de 3",
            "exercises": [
                {"exercise_id": exercise_ids[0], "target_sets": 3, "order": 0, "superset_group": 1},
                {"exercise_id": exercise_ids[1], "target_sets": 3, "order": 1, "superset_group": 1},
                {"exercise_id": exercise_ids[2], "target_sets": 3, "order": 2, "superset_group": 1},
            ],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert [e["superset_group"] for e in body["exercises"]] == [1, 1, 1]

    routine_id = body["id"]
    refetched = client.get(f"/routines/{routine_id}").json()
    assert [e["superset_group"] for e in refetched["exercises"]] == [1, 1, 1]

    client.put("/schedule/0", json={"routine_id": routine_id})
    today = client.get("/today", params={"date": "2026-08-10"}).json()  # Monday
    assert [e["superset_group"] for e in today["exercises"]] == [1, 1, 1]


def test_create_routine_with_superset_group_on_single_exercise_is_400(client: TestClient) -> None:
    exercise_ids = [e["id"] for e in client.get("/exercises").json()[:2]]

    response = client.post(
        "/routines",
        json={
            "name": "Bad superset",
            "exercises": [
                {"exercise_id": exercise_ids[0], "target_sets": 3, "order": 0, "superset_group": 1},
                {"exercise_id": exercise_ids[1], "target_sets": 3, "order": 1, "superset_group": None},
            ],
        },
    )

    assert response.status_code == 400
    assert "superset_group 1" in response.json()["detail"]


def test_update_routine_with_superset_group_on_single_exercise_is_400(client: TestClient) -> None:
    exercise_id = client.get("/exercises").json()[0]["id"]
    routine_id = client.post(
        "/routines",
        json={
            "name": "Original",
            "exercises": [
                {"exercise_id": exercise_id, "target_sets": 3, "order": 0},
            ],
        },
    ).json()["id"]

    response = client.put(
        f"/routines/{routine_id}",
        json={
            "name": "Renamed",
            "exercises": [
                {"exercise_id": exercise_id, "target_sets": 3, "order": 0, "superset_group": 2},
            ],
        },
    )

    assert response.status_code == 400


def test_loose_exercise_with_null_superset_group_behaves_as_before(client: TestClient) -> None:
    exercise_id = client.get("/exercises").json()[0]["id"]

    response = client.post(
        "/routines",
        json={
            "name": "Solo exercises",
            "exercises": [
                {"exercise_id": exercise_id, "target_sets": 3, "order": 0},
            ],
        },
    )

    assert response.status_code == 201
    assert response.json()["exercises"][0]["superset_group"] is None


def test_delete_routine_assigned_to_a_day_clears_the_day_to_null(client: TestClient) -> None:
    exercise_id = client.get("/exercises").json()[0]["id"]
    routine_id = client.post(
        "/routines",
        json={
            "name": "Scheduled routine",
            "exercises": [
                {"exercise_id": exercise_id, "target_sets": 3, "order": 0},
            ],
        },
    ).json()["id"]
    client.put("/schedule/3", json={"routine_id": routine_id})

    response = client.delete(f"/routines/{routine_id}")

    assert response.status_code == 204

    schedule = {entry["day"]: entry["routine_id"] for entry in client.get("/schedule").json()}
    assert schedule[3] is None
