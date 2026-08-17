from fastapi.testclient import TestClient


def test_list_body_metrics_empty_initially(client: TestClient) -> None:
    response = client.get("/body-metrics")

    assert response.status_code == 200
    assert response.json() == []


def test_create_and_list_body_metric(client: TestClient) -> None:
    response = client.post(
        "/body-metrics",
        json={"date": "2026-08-10", "weight": 80.5, "body_fat_pct": 15.2},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] > 0
    assert body["date"] == "2026-08-10"
    assert body["weight"] == 80.5
    assert body["body_fat_pct"] == 15.2

    listed = client.get("/body-metrics").json()
    assert len(listed) == 1
    assert listed[0]["id"] == body["id"]


def test_create_body_metric_without_body_fat_pct(client: TestClient) -> None:
    response = client.post("/body-metrics", json={"date": "2026-08-10", "weight": 80.5})

    assert response.status_code == 201
    assert response.json()["body_fat_pct"] is None


def test_list_body_metrics_ordered_by_date_desc(client: TestClient) -> None:
    client.post("/body-metrics", json={"date": "2026-08-01", "weight": 79.0})
    client.post("/body-metrics", json={"date": "2026-08-15", "weight": 81.0})
    client.post("/body-metrics", json={"date": "2026-08-10", "weight": 80.0})

    listed = client.get("/body-metrics").json()

    assert [m["date"] for m in listed] == ["2026-08-15", "2026-08-10", "2026-08-01"]


def test_delete_body_metric(client: TestClient) -> None:
    create_response = client.post("/body-metrics", json={"date": "2026-08-10", "weight": 80.5})
    metric_id = create_response.json()["id"]

    delete_response = client.delete(f"/body-metrics/{metric_id}")
    assert delete_response.status_code == 204
    assert delete_response.content == b""

    listed = client.get("/body-metrics").json()
    assert listed == []


def test_delete_unknown_body_metric_is_404(client: TestClient) -> None:
    response = client.delete("/body-metrics/9999")

    assert response.status_code == 404


def test_create_body_metric_with_zero_weight_is_422(client: TestClient) -> None:
    response = client.post("/body-metrics", json={"date": "2026-08-10", "weight": 0})

    assert response.status_code == 422


def test_create_body_metric_with_negative_weight_is_422(client: TestClient) -> None:
    response = client.post("/body-metrics", json={"date": "2026-08-10", "weight": -5})

    assert response.status_code == 422


def test_create_body_metric_with_body_fat_pct_out_of_range_is_422(client: TestClient) -> None:
    over = client.post(
        "/body-metrics", json={"date": "2026-08-10", "weight": 80.0, "body_fat_pct": 101}
    )
    under = client.post(
        "/body-metrics", json={"date": "2026-08-10", "weight": 80.0, "body_fat_pct": -1}
    )

    assert over.status_code == 422
    assert under.status_code == 422
