from fastapi.testclient import TestClient


def test_get_schedule_has_all_seven_days(client: TestClient) -> None:
    response = client.get("/schedule")

    assert response.status_code == 200
    body = response.json()
    assert {entry["day"] for entry in body} == set(range(7))


def test_assign_routine_to_a_day(client: TestClient) -> None:
    routine_id = client.get("/routines").json()[0]["id"]

    response = client.put("/schedule/5", json={"routine_id": routine_id})

    assert response.status_code == 200
    assert response.json() == {"day": 5, "routine_id": routine_id}

    schedule = {entry["day"]: entry["routine_id"] for entry in client.get("/schedule").json()}
    assert schedule[5] == routine_id


def test_clear_a_day_by_setting_null(client: TestClient) -> None:
    response = client.put("/schedule/0", json={"routine_id": None})

    assert response.status_code == 200
    assert response.json()["routine_id"] is None


def test_assign_unknown_routine_is_404(client: TestClient) -> None:
    response = client.put("/schedule/1", json={"routine_id": 9999})

    assert response.status_code == 404


def test_invalid_day_is_422(client: TestClient) -> None:
    response = client.put("/schedule/7", json={"routine_id": None})

    assert response.status_code == 422
