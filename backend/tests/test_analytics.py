from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app import models
from app.muscle_taxonomy import MUSCLE_GROUPS
from tests.conftest import TestingSessionLocal


def _exercise_id_by_name(client: TestClient, name: str) -> int:
    exercises = client.get("/exercises").json()
    return next(e["id"] for e in exercises if e["name"] == name)


def _create_exercise(
    client: TestClient,
    *,
    name: str,
    unit: str,
    muscle_group_primary: str,
) -> int:
    response = client.post(
        "/exercises",
        json={
            "name": name,
            "unit": unit,
            "muscle_group_primary": muscle_group_primary,
            "muscle_group_secondary": [],
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_analytics_summary_empty_when_no_workouts(client: TestClient) -> None:
    response = client.get("/analytics/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["week_tonnage"] == 0.0
    assert {v["muscle_group"] for v in body["volume_by_muscle"]} == set(MUSCLE_GROUPS)
    assert all(v["tonnage"] == 0.0 for v in body["volume_by_muscle"])
    assert all(g["days_since_trained"] is None for g in body["days_since_trained"])


def test_analytics_summary_computes_tonnage_and_gaps(client: TestClient) -> None:
    today = date.today()

    pecho_id = _exercise_id_by_name(client, "Press banca")  # muscle_group_primary = Pecho
    espalda_id = _exercise_id_by_name(client, "Peso muerto")  # muscle_group_primary = Espalda
    piernas_id = _exercise_id_by_name(client, "Sentadilla")  # muscle_group_primary = Piernas

    # Dentro de la ventana de 7 días (hoy): Pecho, tonnage 100 * 5 = 500.
    client.post(
        "/workouts",
        json={
            "date": today.isoformat(),
            "sets": [{"exercise_id": pecho_id, "weight": 100, "reps": 5, "order": 0}],
        },
    )

    # Justo en el borde de la ventana (hoy - 6 días): Espalda, tonnage 80 * 4 = 320.
    edge_date = today - timedelta(days=6)
    client.post(
        "/workouts",
        json={
            "date": edge_date.isoformat(),
            "sets": [{"exercise_id": espalda_id, "weight": 80, "reps": 4, "order": 0}],
        },
    )

    # Fuera de la ventana (hoy - 10 días): Piernas, cuenta para days_since_trained
    # pero NO para week_tonnage ni volume_by_muscle.
    out_of_window_date = today - timedelta(days=10)
    client.post(
        "/workouts",
        json={
            "date": out_of_window_date.isoformat(),
            "sets": [{"exercise_id": piernas_id, "weight": 50, "reps": 10, "order": 0}],
        },
    )

    response = client.get("/analytics/summary")

    assert response.status_code == 200
    body = response.json()

    assert body["week_tonnage"] == 820.0  # 500 (Pecho) + 320 (Espalda), Piernas queda fuera

    tonnage_by_group = {v["muscle_group"]: v["tonnage"] for v in body["volume_by_muscle"]}
    assert tonnage_by_group["Pecho"] == 500.0
    assert tonnage_by_group["Espalda"] == 320.0
    # Piernas tiene un set, pero fuera de la ventana de 7 días -> no cuenta como volumen.
    assert tonnage_by_group["Piernas"] == 0.0
    # Grupo sin ningún set en absoluto: sigue apareciendo en la lista, con tonnage 0.0.
    assert tonnage_by_group["Cardio / Otros"] == 0.0

    gaps_by_group = {g["muscle_group"]: g["days_since_trained"] for g in body["days_since_trained"]}
    assert gaps_by_group["Pecho"] == 0
    assert gaps_by_group["Espalda"] == 6
    # Piernas sí cuenta aquí aunque esté fuera de la ventana de 7 días.
    assert gaps_by_group["Piernas"] == 10
    # Grupo sin ningún set en absoluto: None, no desaparece de la lista.
    assert gaps_by_group["Cardio / Otros"] is None
    assert gaps_by_group["Hombros"] is None

    # Orden fijo del catálogo, no el orden en que aparecen los datos.
    assert [v["muscle_group"] for v in body["volume_by_muscle"]] == MUSCLE_GROUPS
    assert [g["muscle_group"] for g in body["days_since_trained"]] == MUSCLE_GROUPS


def test_analytics_summary_tonnage_window_boundary_excludes_eight_days_ago(
    client: TestClient,
) -> None:
    today = date.today()
    pecho_id = _exercise_id_by_name(client, "Press banca")

    # Justo fuera de la ventana por un día (hoy - 7 días): no debe sumar a
    # week_tonnage ni a volume_by_muscle, aunque sí a days_since_trained.
    outside_by_one = today - timedelta(days=7)
    client.post(
        "/workouts",
        json={
            "date": outside_by_one.isoformat(),
            "sets": [{"exercise_id": pecho_id, "weight": 100, "reps": 5, "order": 0}],
        },
    )

    response = client.get("/analytics/summary")

    assert response.status_code == 200
    body = response.json()
    assert body["week_tonnage"] == 0.0
    tonnage_by_group = {v["muscle_group"]: v["tonnage"] for v in body["volume_by_muscle"]}
    assert tonnage_by_group["Pecho"] == 0.0
    gaps_by_group = {g["muscle_group"]: g["days_since_trained"] for g in body["days_since_trained"]}
    assert gaps_by_group["Pecho"] == 7


def test_analytics_summary_unclassified_exercise_counts_week_tonnage_only(
    client: TestClient,
) -> None:
    today = date.today()

    # ExerciseCreate exige muscle_group_primary, así que para forzar un
    # ejercicio sin clasificar hay que insertarlo directo vía el modelo,
    # igual que test_exercises.py::test_list_exercises_with_unclassified_exercise_returns_null_not_500.
    db = TestingSessionLocal()
    try:
        unclassified_exercise = models.Exercise(
            name="Ejercicio sin clasificar de test", unit="kg", muscle_group_primary=None
        )
        db.add(unclassified_exercise)
        db.commit()
        db.refresh(unclassified_exercise)
        unclassified_id = unclassified_exercise.id
    finally:
        db.close()

    client.post(
        "/workouts",
        json={
            "date": today.isoformat(),
            "sets": [{"exercise_id": unclassified_id, "weight": 60, "reps": 10, "order": 0}],
        },
    )

    response = client.get("/analytics/summary")

    assert response.status_code == 200
    body = response.json()

    # Sí debe sumar a week_tonnage: 60 * 10 = 600.
    assert body["week_tonnage"] == 600.0

    # No debe aparecer en ningún grupo de volume_by_muscle (todos siguen en 0).
    assert all(v["tonnage"] == 0.0 for v in body["volume_by_muscle"])
    # Tampoco debe generar un days_since_trained en ningún grupo.
    assert all(g["days_since_trained"] is None for g in body["days_since_trained"])


def test_analytics_summary_future_workout_is_ignored(client: TestClient) -> None:
    today = date.today()
    pecho_id = _exercise_id_by_name(client, "Press banca")

    future_date = today + timedelta(days=3)
    client.post(
        "/workouts",
        json={
            "date": future_date.isoformat(),
            "sets": [{"exercise_id": pecho_id, "weight": 999, "reps": 99, "order": 0}],
        },
    )

    response = client.get("/analytics/summary")

    assert response.status_code == 200
    body = response.json()

    assert body["week_tonnage"] == 0.0
    tonnage_by_group = {v["muscle_group"]: v["tonnage"] for v in body["volume_by_muscle"]}
    assert tonnage_by_group["Pecho"] == 0.0
    gaps_by_group = {g["muscle_group"]: g["days_since_trained"] for g in body["days_since_trained"]}
    assert gaps_by_group["Pecho"] is None


def test_analytics_summary_converts_lb_tonnage_to_kg(client: TestClient) -> None:
    exercise_id = _create_exercise(
        client,
        name="Press libras",
        unit="lb",
        muscle_group_primary="Pecho",
    )
    client.post(
        "/workouts",
        json={
            "date": date.today().isoformat(),
            "sets": [{"exercise_id": exercise_id, "weight": 100, "reps": 5, "order": 0}],
        },
    )

    body = client.get("/analytics/summary").json()

    assert body["week_tonnage"] == pytest.approx(226.796185)


def test_analytics_summary_mixes_units_only_after_conversion_to_kg(
    client: TestClient,
) -> None:
    press_id = _create_exercise(
        client,
        name="Press kilogramos",
        unit="kg",
        muscle_group_primary="Pecho",
    )
    curl_id = _create_exercise(
        client,
        name="Curl libras",
        unit="lb",
        muscle_group_primary="Bíceps",
    )
    client.post(
        "/workouts",
        json={
            "date": date.today().isoformat(),
            "sets": [
                {"exercise_id": press_id, "weight": 100, "reps": 1, "order": 0},
                {"exercise_id": curl_id, "weight": 100, "reps": 1, "order": 1},
            ],
        },
    )

    body = client.get("/analytics/summary").json()
    tonnage_by_group = {item["muscle_group"]: item["tonnage"] for item in body["volume_by_muscle"]}

    assert body["week_tonnage"] == pytest.approx(145.359237)
    assert tonnage_by_group["Bíceps"] == pytest.approx(45.359237)


def test_analytics_summary_treats_bodyweight_as_resolved_kg(client: TestClient) -> None:
    exercise_id = _create_exercise(
        client,
        name="Dominada lastrada",
        unit="bw",
        muscle_group_primary="Espalda",
    )
    client.post(
        "/workouts",
        json={
            "date": date.today().isoformat(),
            "sets": [{"exercise_id": exercise_id, "weight": 80, "reps": 10, "order": 0}],
        },
    )

    body = client.get("/analytics/summary").json()

    assert body["week_tonnage"] == 800.0


def test_analytics_summary_uses_set_unit_not_exercise_default(client: TestClient) -> None:
    exercise_id = _create_exercise(
        client,
        name="Remo un día en libras",
        unit="kg",
        muscle_group_primary="Espalda",
    )
    client.post(
        "/workouts",
        json={
            "date": date.today().isoformat(),
            "sets": [
                {
                    "exercise_id": exercise_id,
                    "weight": 100,
                    "reps": 1,
                    "order": 0,
                    "unit": "lb",
                }
            ],
        },
    )

    body = client.get("/analytics/summary").json()

    assert body["week_tonnage"] == pytest.approx(45.359237)
