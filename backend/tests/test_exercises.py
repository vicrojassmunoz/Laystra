from fastapi.testclient import TestClient

from app import models
from app.muscle_taxonomy import EXERCISE_MUSCLE_GROUPS
from tests.conftest import TestingSessionLocal


def test_list_exercises_returns_seeded_data(client: TestClient) -> None:
    response = client.get("/exercises")

    assert response.status_code == 200
    names = {e["name"] for e in response.json()}
    assert "Press banca" in names


def test_list_exercises_seed_is_classified_by_muscle_group(client: TestClient) -> None:
    """Los 24 ejercicios de app/seed.py nacen ya clasificados (DB nueva, sin
    pasar por el backfill ad-hoc de app/db.py, que es solo para producción)."""
    response = client.get("/exercises")

    assert response.status_code == 200
    by_name = {e["name"]: e for e in response.json()}
    assert set(by_name) == set(EXERCISE_MUSCLE_GROUPS)

    for name, (expected_primary, expected_secondary) in EXERCISE_MUSCLE_GROUPS.items():
        exercise = by_name[name]
        assert exercise["muscle_group_primary"] == expected_primary
        assert exercise["muscle_group_secondary"] == expected_secondary


def test_list_exercises_with_unclassified_exercise_returns_null_not_500(
    client: TestClient,
) -> None:
    """Un ejercicio con muscle_group_primary NULL en DB (el estado permanente que
    deja _backfill_muscle_groups para un nombre no reconocido, ver
    test_backfill_muscle_groups_leaves_unknown_exercise_name_as_null en
    test_db_migration.py) no debe tumbar GET /exercises entero con un 500 de
    ResponseValidationError — solo esa fila debe venir con el campo en null.
    Inserta directamente vía el modelo, sin pasar por ExerciseCreate (que exige
    el campo), para reproducir ese estado igual que en producción."""
    db = TestingSessionLocal()
    try:
        db.add(models.Exercise(name="Ejercicio inventado", unit="kg", muscle_group_primary=None))
        db.commit()
    finally:
        db.close()

    response = client.get("/exercises")

    assert response.status_code == 200
    by_name = {e["name"]: e for e in response.json()}
    assert by_name["Ejercicio inventado"]["muscle_group_primary"] is None
    assert by_name["Ejercicio inventado"]["muscle_group_secondary"] == []


def test_create_exercise(client: TestClient) -> None:
    response = client.post(
        "/exercises",
        json={
            "name": "Curl biceps",
            "unit": "kg",
            "muscle_group_primary": "Bíceps",
            "muscle_group_secondary": [],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Curl biceps"
    assert body["id"] > 0
    assert body["muscle_group_primary"] == "Bíceps"
    assert body["muscle_group_secondary"] == []

    listed = client.get("/exercises").json()
    assert any(e["id"] == body["id"] for e in listed)


def test_create_exercise_with_secondary_muscles_round_trips_in_order(client: TestClient) -> None:
    response = client.post(
        "/exercises",
        json={
            "name": "Press militar",
            "unit": "kg",
            "muscle_group_primary": "Hombros",
            "muscle_group_secondary": ["Tríceps", "Pecho"],
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["muscle_group_primary"] == "Hombros"
    # exercise_secondary_muscles no tiene columna "order" propia, pero la relación
    # secondary_muscles ordena explícitamente por ExerciseSecondaryMuscle.id (ver
    # models.py), que coincide con el orden de inserción/envío.
    assert body["muscle_group_secondary"] == ["Tríceps", "Pecho"]

    fetched = client.get("/exercises").json()
    created = next(e for e in fetched if e["id"] == body["id"])
    assert created["muscle_group_secondary"] == ["Tríceps", "Pecho"]


def test_create_exercise_without_muscle_group_primary_is_422(client: TestClient) -> None:
    response = client.post("/exercises", json={"name": "Curl biceps", "unit": "kg"})

    assert response.status_code == 422


def test_progress_for_unknown_exercise_is_404(client: TestClient) -> None:
    response = client.get("/exercises/9999/progress")

    assert response.status_code == 404


def test_progress_empty_for_exercise_with_no_workouts(client: TestClient) -> None:
    exercises = client.get("/exercises").json()
    exercise_id = exercises[0]["id"]

    response = client.get(f"/exercises/{exercise_id}/progress")

    assert response.status_code == 200
    assert response.json()["points"] == []
