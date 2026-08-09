from fastapi.testclient import TestClient


def test_today_requires_date_query_param(client: TestClient) -> None:
    response = client.get("/today")

    assert response.status_code == 422


def test_today_on_monday_returns_seeded_push_day(client: TestClient) -> None:
    # 2026-08-10 is a Monday
    response = client.get("/today", params={"date": "2026-08-10"})

    assert response.status_code == 200
    body = response.json()
    assert body["day_of_week"] == 0
    assert body["routine_name"] == "Push day"
    assert len(body["exercises"]) > 0


def test_today_on_rest_day_returns_empty_routine(client: TestClient) -> None:
    # 2026-08-14 is a Friday, unassigned in seed data
    response = client.get("/today", params={"date": "2026-08-14"})

    assert response.status_code == 200
    body = response.json()
    assert body["routine_id"] is None
    assert body["exercises"] == []
