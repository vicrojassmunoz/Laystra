import os
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import Engine, create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

# backend/laystra.db — sibling of pyproject.toml, not inside app/.
# Overridable via LAYSTRA_DB_PATH (Docker mounts a volume outside the image here).
_DEFAULT_DB_PATH = Path(__file__).resolve().parent.parent / "laystra.db"
DB_PATH = Path(os.environ.get("LAYSTRA_DB_PATH", _DEFAULT_DB_PATH))
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@event.listens_for(engine, "connect")
def _enable_sqlite_foreign_keys(dbapi_connection, connection_record) -> None:
    """SQLite ignores FK constraints unless enabled per-connection."""
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    """Create tables that don't exist yet. No migrations (Alembic) in Fase 1 — see MVP.md."""
    Base.metadata.create_all(bind=engine)
    _add_missing_columns()


# Ligero mecanismo de migración ad-hoc: este proyecto no usa Alembic, y
# Base.metadata.create_all() en SQLite crea tablas nuevas pero NUNCA añade
# columnas a tablas ya existentes. La DB de producción (laystra.db) tiene
# entrenos reales del usuario y no se puede resetear/recrear, así que cada vez
# que un modelo gana una columna nueva hace falta un ALTER TABLE idempotente
# como el de abajo. Comprobamos con PRAGMA table_info si la columna ya existe
# antes de intentar añadirla, para que esto sea seguro de ejecutar en cada
# arranque tanto en una DB nueva (create_all ya la crea con la columna) como
# en una DB antigua que aún no la tiene.
_COLUMNS_TO_ADD: dict[str, list[tuple[str, str]]] = {
    "routine_exercises": [("superset_group", "INTEGER")],
    "workout_sets": [("superset_group", "INTEGER")],
}


def _add_missing_columns(target_engine: Engine | None = None) -> None:
    """target_engine es sobre todo para tests (apuntar a una DB temporal en
    lugar del engine de módulo); en producción siempre se llama sin argumento."""
    with (target_engine or engine).connect() as conn:
        for table, columns in _COLUMNS_TO_ADD.items():
            existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
            if not existing:
                # PRAGMA table_info devuelve vacío tanto si la tabla no existe como si
                # existe pero no tiene columnas (caso imposible en la práctica). Si la
                # clave en _COLUMNS_TO_ADD no corresponde a ninguna tabla real (typo,
                # tabla renombrada), saltarla en vez de intentar un ALTER TABLE que
                # fallaría con OperationalError y tumbaría el arranque de la app.
                continue
            for column_name, column_type in columns:
                if column_name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column_name} {column_type}"))
        conn.commit()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
