from fastapi.testclient import TestClient


def _add(client: TestClient, date: str, ml: int, container_name: str | None = None) -> dict:
    response = client.post(
        "/water/entries", json={"date": date, "ml": ml, "container_name": container_name}
    )
    assert response.status_code == 201
    return response.json()


def test_day_starts_empty_with_default_goal(client: TestClient) -> None:
    response = client.get("/water", params={"date": "2026-10-01"})

    assert response.status_code == 200
    assert response.json() == {"date": "2026-10-01", "total_ml": 0, "goal_ml": 2500, "entries": []}


def test_entries_add_up_per_day_and_can_be_deleted(client: TestClient) -> None:
    first = _add(client, "2026-10-01", 250, "Vaso")
    _add(client, "2026-10-01", 400)
    _add(client, "2026-10-02", 500, "Botella")

    day = client.get("/water", params={"date": "2026-10-01"}).json()
    assert day["total_ml"] == 650
    assert [e["container_name"] for e in day["entries"]] == ["Vaso", None]

    assert client.delete(f"/water/entries/{first['id']}").status_code == 204
    assert client.get("/water", params={"date": "2026-10-01"}).json()["total_ml"] == 400
    assert client.delete(f"/water/entries/{first['id']}").status_code == 404


def test_entry_validation(client: TestClient) -> None:
    for ml in (0, -50, 5001):
        response = client.post("/water/entries", json={"date": "2026-10-01", "ml": ml})
        assert response.status_code == 422


def test_default_containers_are_seeded_once(client: TestClient) -> None:
    containers = client.get("/water/containers").json()
    assert sorted((c["name"], c["ml"]) for c in containers) == [
        ("Botella", 500),
        ("Botella grande", 1000),
        ("Taza", 300),
        ("Vaso", 250),
    ]

    for container in containers:
        assert client.delete(f"/water/containers/{container['id']}").status_code == 204
    # Borrarlos todos no los vuelve a sembrar.
    assert client.get("/water/containers").json() == []


def test_container_crud_and_resize_does_not_rewrite_history(client: TestClient) -> None:
    created = client.post("/water/containers", json={"name": "  Mi bidón ", "ml": 750})
    assert created.status_code == 201
    assert created.json()["name"] == "Mi bidón"

    _add(client, "2026-10-01", 750, "Mi bidón")

    resized = client.put(
        f"/water/containers/{created.json()['id']}", json={"name": "Mi bidón", "ml": 600}
    )
    assert resized.status_code == 200
    assert resized.json()["ml"] == 600
    assert client.get("/water", params={"date": "2026-10-01"}).json()["total_ml"] == 750

    assert client.put("/water/containers/9999", json={"name": "x", "ml": 1}).status_code == 404
    assert client.post("/water/containers", json={"name": "   ", "ml": 100}).status_code == 422
    assert client.post("/water/containers", json={"name": "Gigante", "ml": 99999}).status_code == 422


def test_goal_update_reflected_in_day(client: TestClient) -> None:
    assert client.put("/water/settings", json={"goal_ml": 3000}).json() == {"goal_ml": 3000}
    assert client.get("/water/settings").json() == {"goal_ml": 3000}
    assert client.get("/water", params={"date": "2026-10-01"}).json()["goal_ml"] == 3000
    assert client.put("/water/settings", json={"goal_ml": 5}).status_code == 422


def test_history_includes_empty_days_newest_first(client: TestClient) -> None:
    _add(client, "2026-10-03", 300)
    _add(client, "2026-10-03", 200)
    _add(client, "2026-10-01", 500)
    _add(client, "2026-09-20", 999)  # fuera de la ventana

    history = client.get("/water/history", params={"end": "2026-10-03", "days": 3}).json()

    assert history == [
        {"date": "2026-10-03", "total_ml": 500},
        {"date": "2026-10-02", "total_ml": 0},
        {"date": "2026-10-01", "total_ml": 500},
    ]
    assert client.get("/water/history", params={"end": "2026-10-03", "days": 0}).status_code == 422


def test_export_csv_has_bom_header_and_rows(client: TestClient) -> None:
    _add(client, "2026-10-01", 250, "Vaso")
    _add(client, "2026-10-02", 400)

    response = client.get("/water/export")

    assert response.status_code == 200
    assert response.content.startswith("﻿".encode("utf-8"))
    assert response.headers["content-disposition"] == 'attachment; filename="laystra-water.csv"'
    lines = response.content.decode("utf-8-sig").splitlines()
    assert lines == ["date,ml,container", "2026-10-02,400,", "2026-10-01,250,Vaso"]
