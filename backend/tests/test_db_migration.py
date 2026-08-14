"""Cobertura para el mecanismo de migración ad-hoc en app/db.py
(_add_missing_columns). El resto de la suite usa una DB en memoria creada ya
con el schema final (ver conftest.py), así que este archivo aparte es el
único sitio que ejercita el ALTER TABLE idempotente contra un schema "viejo"
real, en un fichero SQLite temporal — igual que laystra.db en producción."""

import sqlite3

import pytest
from sqlalchemy import create_engine, text

from app.db import Base, _add_missing_columns, _backfill_muscle_groups
from app.muscle_taxonomy import EXERCISE_MUSCLE_GROUPS


@pytest.fixture
def old_schema_db(tmp_path):
    """DB SQLite en un fichero temporal con routine_exercises y workout_sets
    creadas a mano SIN la columna superset_group (schema pre-migración), con
    una fila ya insertada en cada una para verificar que la migración no
    pierde datos existentes."""
    db_path = tmp_path / "old_schema.db"
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        """
        CREATE TABLE routine_exercises (
            id INTEGER PRIMARY KEY,
            routine_id INTEGER NOT NULL,
            exercise_id INTEGER NOT NULL,
            target_sets INTEGER NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE workout_sets (
            id INTEGER PRIMARY KEY,
            workout_exercise_id INTEGER NOT NULL,
            weight REAL,
            reps INTEGER
        )
        """
    )
    conn.execute(
        "INSERT INTO routine_exercises (id, routine_id, exercise_id, target_sets) VALUES (1, 1, 1, 3)"
    )
    conn.execute(
        "INSERT INTO workout_sets (id, workout_exercise_id, weight, reps) VALUES (1, 1, 50.0, 10)"
    )
    conn.commit()
    conn.close()
    return db_path


def test_add_missing_columns_adds_column_without_losing_rows(old_schema_db):
    engine = create_engine(f"sqlite:///{old_schema_db}")

    _add_missing_columns(target_engine=engine)

    with engine.connect() as conn:
        re_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(routine_exercises)"))}
        ws_columns = {row[1] for row in conn.execute(text("PRAGMA table_info(workout_sets)"))}
        assert "superset_group" in re_columns
        assert "superset_group" in ws_columns

        re_row = conn.execute(text("SELECT id, routine_id, exercise_id, target_sets, superset_group FROM routine_exercises")).fetchone()
        assert re_row == (1, 1, 1, 3, None)

        ws_row = conn.execute(text("SELECT id, workout_exercise_id, weight, reps, superset_group FROM workout_sets")).fetchone()
        assert ws_row == (1, 1, 50.0, 10, None)


def test_add_missing_columns_is_idempotent(old_schema_db):
    engine = create_engine(f"sqlite:///{old_schema_db}")

    _add_missing_columns(target_engine=engine)
    # Segunda llamada: la columna ya existe, no debe intentar re-añadirla ni fallar.
    _add_missing_columns(target_engine=engine)

    with engine.connect() as conn:
        columns = {row[1] for row in conn.execute(text("PRAGMA table_info(routine_exercises)"))}
        assert "superset_group" in columns


@pytest.fixture
def old_schema_exercises_db(tmp_path):
    """DB SQLite en fichero temporal con una tabla exercises "vieja" (sin
    muscle_group_primary, sin exercise_secondary_muscles) y los 24 ejercicios
    reales ya insertados por nombre, tal y como estaría laystra.db en
    producción antes de este cambio."""
    db_path = tmp_path / "old_exercises.db"
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        """
        CREATE TABLE exercises (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            unit TEXT NOT NULL DEFAULT 'kg'
        )
        """
    )
    for i, name in enumerate(EXERCISE_MUSCLE_GROUPS, start=1):
        conn.execute("INSERT INTO exercises (id, name, unit) VALUES (?, ?, 'kg')", (i, name))
    conn.commit()
    conn.close()
    return db_path


def _run_full_migration(engine) -> None:
    """Mismo orden que init_db(): create_all crea las tablas nuevas que falten
    (aquí, exercise_secondary_muscles) sin tocar las que ya existen, luego el
    ALTER TABLE idempotente, luego el backfill de datos."""
    Base.metadata.create_all(bind=engine)
    _add_missing_columns(target_engine=engine)
    _backfill_muscle_groups(target_engine=engine)


def test_backfill_muscle_groups_classifies_existing_exercises_by_name(old_schema_exercises_db):
    engine = create_engine(f"sqlite:///{old_schema_exercises_db}")

    _run_full_migration(engine)

    with engine.connect() as conn:
        rows = conn.execute(text("SELECT id, name, muscle_group_primary FROM exercises")).fetchall()
        assert len(rows) == len(EXERCISE_MUSCLE_GROUPS)

        for exercise_id, name, primary in rows:
            expected_primary, expected_secondary = EXERCISE_MUSCLE_GROUPS[name]
            assert primary == expected_primary

            secondary_rows = conn.execute(
                text("SELECT muscle_group FROM exercise_secondary_muscles WHERE exercise_id = :id"),
                {"id": exercise_id},
            ).fetchall()
            assert sorted(r[0] for r in secondary_rows) == sorted(expected_secondary)


def test_backfill_muscle_groups_is_idempotent(old_schema_exercises_db):
    engine = create_engine(f"sqlite:///{old_schema_exercises_db}")

    _run_full_migration(engine)
    # Segunda pasada completa: no debe duplicar filas en la tabla hija.
    _run_full_migration(engine)

    with engine.connect() as conn:
        total_secondary_rows = conn.execute(
            text("SELECT COUNT(*) FROM exercise_secondary_muscles")
        ).scalar()
        expected_total = sum(len(secondaries) for _, secondaries in EXERCISE_MUSCLE_GROUPS.values())
        assert total_secondary_rows == expected_total


def test_backfill_muscle_groups_leaves_unknown_exercise_name_as_null(tmp_path):
    db_path = tmp_path / "unknown_exercise.db"
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        """
        CREATE TABLE exercises (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            unit TEXT NOT NULL DEFAULT 'kg'
        )
        """
    )
    conn.execute("INSERT INTO exercises (id, name, unit) VALUES (1, 'Ejercicio inventado', 'kg')")
    conn.commit()
    conn.close()

    engine = create_engine(f"sqlite:///{db_path}")
    _run_full_migration(engine)

    with engine.connect() as conn:
        row = conn.execute(
            text("SELECT muscle_group_primary FROM exercises WHERE id = 1")
        ).fetchone()
        assert row[0] is None

        secondary_count = conn.execute(
            text("SELECT COUNT(*) FROM exercise_secondary_muscles WHERE exercise_id = 1")
        ).scalar()
        assert secondary_count == 0


def test_add_missing_columns_skips_nonexistent_table(tmp_path, monkeypatch):
    """Si _COLUMNS_TO_ADD tuviera una clave que no corresponde a ninguna tabla
    real (typo, tabla renombrada), no debe reventar con OperationalError —
    debe saltarla y seguir con el resto."""
    import app.db as db_module

    db_path = tmp_path / "empty.db"
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "CREATE TABLE workout_sets (id INTEGER PRIMARY KEY, workout_exercise_id INTEGER NOT NULL)"
    )
    conn.commit()
    conn.close()

    monkeypatch.setattr(
        db_module,
        "_COLUMNS_TO_ADD",
        {
            "routine_exercises_typo": [("superset_group", "INTEGER")],
            "workout_sets": [("superset_group", "INTEGER")],
        },
    )

    engine = create_engine(f"sqlite:///{db_path}")

    _add_missing_columns(target_engine=engine)

    with engine.connect() as conn:
        columns = {row[1] for row in conn.execute(text("PRAGMA table_info(workout_sets)"))}
        assert "superset_group" in columns
