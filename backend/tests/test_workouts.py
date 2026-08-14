from fastapi.testclient import TestClient


def test_list_workouts_empty_initially(client: TestClient) -> None:
    response = client.get("/workouts")

    assert response.status_code == 200
    assert response.json() == []


def test_create_and_fetch_workout(client: TestClient) -> None:
    exercise_id = client.get("/exercises").json()[0]["id"]

    create_response = client.post(
        "/workouts",
        json={
            "date": "2026-08-09",
            "sets": [
                {"exercise_id": exercise_id, "weight": 60, "reps": 8, "order": 0},
                {"exercise_id": exercise_id, "weight": 62.5, "reps": 6, "order": 1},
            ],
        },
    )

    assert create_response.status_code == 201
    workout = create_response.json()
    assert len(workout["sets"]) == 2

    get_response = client.get(f"/workouts/{workout['id']}")
    assert get_response.status_code == 200
    assert get_response.json()["id"] == workout["id"]

    listed = client.get("/workouts").json()
    assert listed[0]["id"] == workout["id"]


def test_create_workout_with_unknown_exercise_is_404(client: TestClient) -> None:
    response = client.post(
        "/workouts",
        json={"date": "2026-08-09", "sets": [{"exercise_id": 9999, "weight": 10, "reps": 5, "order": 0}]},
    )

    assert response.status_code == 404


def test_negative_reps_is_rejected(client: TestClient) -> None:
    exercise_id = client.get("/exercises").json()[0]["id"]

    response = client.post(
        "/workouts",
        json={"date": "2026-08-09", "sets": [{"exercise_id": exercise_id, "weight": 10, "reps": -1, "order": 0}]},
    )

    assert response.status_code == 422


def test_get_unknown_workout_is_404(client: TestClient) -> None:
    response = client.get("/workouts/9999")

    assert response.status_code == 404


def test_update_workout_changes_sets(client: TestClient) -> None:
    exercise_id = client.get("/exercises").json()[0]["id"]

    create_response = client.post(
        "/workouts",
        json={
            "date": "2026-08-09",
            "sets": [{"exercise_id": exercise_id, "weight": 60, "reps": 8, "order": 0}],
        },
    )
    workout_id = create_response.json()["id"]

    update_response = client.put(
        f"/workouts/{workout_id}",
        json={
            "date": "2026-08-10",
            "sets": [
                {"exercise_id": exercise_id, "weight": 65, "reps": 5, "order": 0},
                {"exercise_id": exercise_id, "weight": 67.5, "reps": 3, "order": 1},
            ],
        },
    )

    assert update_response.status_code == 200
    updated = update_response.json()
    assert updated["date"] == "2026-08-10"
    assert len(updated["sets"]) == 2
    assert updated["sets"][0]["weight"] == 65
    assert updated["sets"][0]["reps"] == 5

    get_response = client.get(f"/workouts/{workout_id}")
    assert get_response.status_code == 200
    fetched = get_response.json()
    assert len(fetched["sets"]) == 2
    assert fetched["sets"][1]["weight"] == 67.5


def test_update_unknown_workout_is_404(client: TestClient) -> None:
    exercise_id = client.get("/exercises").json()[0]["id"]

    response = client.put(
        "/workouts/9999",
        json={
            "date": "2026-08-09",
            "sets": [{"exercise_id": exercise_id, "weight": 10, "reps": 5, "order": 0}],
        },
    )

    assert response.status_code == 404


def test_update_workout_with_unknown_exercise_is_404(client: TestClient) -> None:
    exercise_id = client.get("/exercises").json()[0]["id"]

    create_response = client.post(
        "/workouts",
        json={
            "date": "2026-08-09",
            "sets": [{"exercise_id": exercise_id, "weight": 60, "reps": 8, "order": 0}],
        },
    )
    workout_id = create_response.json()["id"]

    response = client.put(
        f"/workouts/{workout_id}",
        json={"date": "2026-08-09", "sets": [{"exercise_id": 9999, "weight": 10, "reps": 5, "order": 0}]},
    )

    assert response.status_code == 404


def test_delete_workout(client: TestClient) -> None:
    exercise_id = client.get("/exercises").json()[0]["id"]

    create_response = client.post(
        "/workouts",
        json={
            "date": "2026-08-09",
            "sets": [{"exercise_id": exercise_id, "weight": 60, "reps": 8, "order": 0}],
        },
    )
    workout_id = create_response.json()["id"]

    delete_response = client.delete(f"/workouts/{workout_id}")
    assert delete_response.status_code == 204
    assert delete_response.content == b""

    get_response = client.get(f"/workouts/{workout_id}")
    assert get_response.status_code == 404


def test_delete_unknown_workout_is_404(client: TestClient) -> None:
    response = client.delete("/workouts/9999")

    assert response.status_code == 404


def test_create_workout_with_superset_group_persists_and_reads_back(client: TestClient) -> None:
    exercise_ids = [e["id"] for e in client.get("/exercises").json()[:2]]

    response = client.post(
        "/workouts",
        json={
            "date": "2026-08-09",
            "sets": [
                {"exercise_id": exercise_ids[0], "weight": 40, "reps": 10, "order": 0, "superset_group": 1},
                {"exercise_id": exercise_ids[1], "weight": 20, "reps": 12, "order": 1, "superset_group": 1},
                {"exercise_id": exercise_ids[0], "weight": 40, "reps": 8, "order": 2, "superset_group": 2},
                {"exercise_id": exercise_ids[1], "weight": 20, "reps": 10, "order": 3, "superset_group": 2},
            ],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert [s["superset_group"] for s in body["sets"]] == [1, 1, 2, 2]

    refetched = client.get(f"/workouts/{body['id']}").json()
    assert [s["superset_group"] for s in refetched["sets"]] == [1, 1, 2, 2]


def test_create_free_workout_with_superset_group_persists(client: TestClient) -> None:
    exercise_ids = [e["id"] for e in client.get("/exercises").json()[:2]]

    response = client.post(
        "/workouts",
        json={
            "date": "2026-08-09",
            "routine_id": None,
            "sets": [
                {"exercise_id": exercise_ids[0], "weight": 40, "reps": 10, "order": 0, "superset_group": 1},
                {"exercise_id": exercise_ids[1], "weight": 20, "reps": 12, "order": 1, "superset_group": 1},
            ],
        },
    )

    assert response.status_code == 201
    assert [s["superset_group"] for s in response.json()["sets"]] == [1, 1]


def test_create_workout_with_superset_group_on_single_exercise_is_400(client: TestClient) -> None:
    exercise_id = client.get("/exercises").json()[0]["id"]

    response = client.post(
        "/workouts",
        json={
            "date": "2026-08-09",
            "sets": [
                {"exercise_id": exercise_id, "weight": 40, "reps": 10, "order": 0, "superset_group": 1},
                {"exercise_id": exercise_id, "weight": 40, "reps": 8, "order": 1, "superset_group": 1},
            ],
        },
    )

    assert response.status_code == 400
    assert "superset_group 1" in response.json()["detail"]


def test_update_workout_with_superset_group_on_single_exercise_is_400(client: TestClient) -> None:
    exercise_id = client.get("/exercises").json()[0]["id"]

    create_response = client.post(
        "/workouts",
        json={
            "date": "2026-08-09",
            "sets": [{"exercise_id": exercise_id, "weight": 60, "reps": 8, "order": 0}],
        },
    )
    workout_id = create_response.json()["id"]

    response = client.put(
        f"/workouts/{workout_id}",
        json={
            "date": "2026-08-09",
            "sets": [{"exercise_id": exercise_id, "weight": 60, "reps": 8, "order": 0, "superset_group": 1}],
        },
    )

    assert response.status_code == 400


def test_loose_set_with_null_superset_group_behaves_as_before(client: TestClient) -> None:
    exercise_id = client.get("/exercises").json()[0]["id"]

    response = client.post(
        "/workouts",
        json={
            "date": "2026-08-09",
            "sets": [{"exercise_id": exercise_id, "weight": 60, "reps": 8, "order": 0}],
        },
    )

    assert response.status_code == 201
    assert response.json()["sets"][0]["superset_group"] is None


def test_progress_reflects_logged_workout(client: TestClient) -> None:
    exercise_id = client.get("/exercises").json()[0]["id"]
    client.post(
        "/workouts",
        json={
            "date": "2026-08-09",
            "sets": [{"exercise_id": exercise_id, "weight": 60, "reps": 8, "order": 0}],
        },
    )

    response = client.get(f"/exercises/{exercise_id}/progress")

    assert response.status_code == 200
    points = response.json()["points"]
    assert len(points) == 1
    assert points[0]["best_weight"] == 60
