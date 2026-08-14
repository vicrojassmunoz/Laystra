"""Cobertura para el mecanismo de migración ad-hoc en app/db.py
(_add_missing_columns). El resto de la suite usa una DB en memoria creada ya
con el schema final (ver conftest.py), así que este archivo aparte es el
único sitio que ejercita el ALTER TABLE idempotente contra un schema "viejo"
real, en un fichero SQLite temporal — igual que laystra.db en producción."""

import sqlite3

import pytest
from sqlalchemy import create_engine, text

from app.db import _add_missing_columns


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
