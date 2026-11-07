from datetime import date as date_

from sqlalchemy import ForeignKey, Index, UniqueConstraint, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    unit: Mapped[str] = mapped_column(default="kg")
    # Conceptualmente obligatorio a partir de este cambio (ver ExerciseCreate en
    # app/schemas/exercise.py, que lo exige como campo requerido). Nullable aquí a
    # nivel de DB solo porque los 24 ejercicios ya existentes en producción (laystra.db)
    # no lo tienen todavía, y ALTER TABLE ADD COLUMN en SQLite no permite añadir una
    # columna NOT NULL sin un valor por defecto constante igual para todas las filas.
    # Se backfillea por nombre de ejercicio en app/db.py (_backfill_muscle_groups).
    muscle_group_primary: Mapped[str | None] = mapped_column(nullable=True, default=None)

    secondary_muscles: Mapped[list["ExerciseSecondaryMuscle"]] = relationship(
        cascade="all, delete-orphan",
        # selectin evita el N+1 al listar ejercicios (1 query extra para todos los
        # secundarios en vez de una por ejercicio) y desacopla la serialización del
        # ciclo de vida de la sesión, en vez de depender del lazy-load implícito por
        # estar dentro del mismo scope de sesión que el router. order_by hace que el
        # orden de los secundarios en la respuesta sea explícito por código, no una
        # garantía incidental del orden de rowid de SQLite.
        lazy="selectin",
        order_by="ExerciseSecondaryMuscle.id",
    )

    @property
    def muscle_group_secondary(self) -> list[str]:
        """Derivado de secondary_muscles, no una columna propia — permite que el
        schema Pydantic de respuesta lo lea vía from_attributes como cualquier
        otro atributo, sin reconstruir el JSON a mano en el router."""
        return [s.muscle_group for s in self.secondary_muscles]


class ExerciseSecondaryMuscle(Base):
    __tablename__ = "exercise_secondary_muscles"

    id: Mapped[int] = mapped_column(primary_key=True)
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id", ondelete="CASCADE"))
    muscle_group: Mapped[str]


class Routine(Base):
    __tablename__ = "routines"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]

    exercises: Mapped[list["RoutineExercise"]] = relationship(
        back_populates="routine",
        cascade="all, delete-orphan",
        order_by="RoutineExercise.order",
    )


class RoutineExercise(Base):
    __tablename__ = "routine_exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    routine_id: Mapped[int] = mapped_column(ForeignKey("routines.id"))
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"))
    target_sets: Mapped[int]
    order: Mapped[int]
    # Agrupa ejercicios en un bloque de super-serie dentro de esta rutina. Nulo =
    # ejercicio suelto. Mismo entero = mismo bloque. Solo comparable dentro de la
    # misma rutina, no es un ID global. Ver ADD COLUMN idempotente en app/db.py.
    superset_group: Mapped[int | None] = mapped_column(nullable=True, default=None)

    routine: Mapped["Routine"] = relationship(back_populates="exercises")


class ScheduleEntry(Base):
    __tablename__ = "schedule_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    day: Mapped[int] = mapped_column(unique=True)  # 0 = Monday ... 6 = Sunday
    routine_id: Mapped[int | None] = mapped_column(
        ForeignKey("routines.id", ondelete="SET NULL"), nullable=True
    )


class Workout(Base):
    __tablename__ = "workouts"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date_]
    routine_id: Mapped[int | None] = mapped_column(
        ForeignKey("routines.id", ondelete="SET NULL"), nullable=True
    )
    # Sensaciones del entreno (texto libre). Nulo = sin nota. ADD COLUMN
    # idempotente en app/db.py para la DB de producción.
    notes: Mapped[str | None] = mapped_column(nullable=True, default=None)
    # Duración de la sesión en segundos (cronómetro de la pantalla Sesión). Nulo =
    # no medida. ADD COLUMN idempotente en app/db.py.
    duration_seconds: Mapped[int | None] = mapped_column(nullable=True, default=None)

    sets: Mapped[list["WorkoutSet"]] = relationship(
        back_populates="workout",
        cascade="all, delete-orphan",
        order_by="WorkoutSet.order",
    )


class WorkoutSet(Base):
    __tablename__ = "workout_sets"

    id: Mapped[int] = mapped_column(primary_key=True)
    workout_id: Mapped[int] = mapped_column(ForeignKey("workouts.id"))
    exercise_id: Mapped[int] = mapped_column(ForeignKey("exercises.id"))
    weight: Mapped[float]
    reps: Mapped[int]
    order: Mapped[int]
    # Instantánea de la unidad al loguear (kg/lb/bw). Independiente de
    # Exercise.unit, que solo es el default para sesiones nuevas. Nullable en
    # DB por el ALTER TABLE sobre filas ya existentes; se backfillea desde el
    # ejercicio. Ver app/db.py.
    unit: Mapped[str | None] = mapped_column(nullable=True, default=None)
    # Agrupa sets en un bloque de super-serie dentro de este workout ya logueado
    # (real o libre). Independiente de RoutineExercise.superset_group: un workout
    # libre no tiene RoutineExercise detrás, así que lo realmente ejecutado se
    # agrupa aparte. Nulo = set suelto. Ver ADD COLUMN idempotente en app/db.py.
    superset_group: Mapped[int | None] = mapped_column(nullable=True, default=None)

    workout: Mapped["Workout"] = relationship(back_populates="sets")


class BodyMetric(Base):
    __tablename__ = "body_metrics"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date_]
    weight: Mapped[float]
    body_fat_pct: Mapped[float | None] = mapped_column(nullable=True, default=None)


class Goal(Base):
    __tablename__ = "goals"

    id: Mapped[int] = mapped_column(primary_key=True)
    text: Mapped[str]
    target_value: Mapped[float | None] = mapped_column(nullable=True, default=None)
    target_date: Mapped[date_ | None] = mapped_column(nullable=True, default=None)
    done: Mapped[bool] = mapped_column(default=False)


class WaterContainer(Base):
    """Recipiente con capacidad por defecto (vaso, botella...). Editable: cambiar
    `ml` solo afecta a entradas futuras, WaterEntry guarda su propio ml."""

    __tablename__ = "water_containers"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    ml: Mapped[int]


class WaterEntry(Base):
    __tablename__ = "water_entries"

    id: Mapped[int] = mapped_column(primary_key=True)
    date: Mapped[date_]
    ml: Mapped[int]
    # Instantánea del nombre del recipiente usado (nulo = cantidad directa en ml).
    # Texto y no FK: borrar o renombrar un recipiente no reescribe el histórico.
    container_name: Mapped[str | None] = mapped_column(nullable=True, default=None)


class WaterSettings(Base):
    """Fila única (id=1) con el objetivo diario de agua, creada al primer uso."""

    __tablename__ = "water_settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    goal_ml: Mapped[int] = mapped_column(default=2500)


class Injury(Base):
    __tablename__ = "injuries"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str]
    body_area: Mapped[str]
    severity: Mapped[str]
    since: Mapped[date_]
    active: Mapped[bool] = mapped_column(default=True)
    notes: Mapped[str | None] = mapped_column(nullable=True, default=None)


class Habit(Base):
    __tablename__ = "habits"
    # A lo sumo un hábito water y uno steps (índice único parcial por kind).
    # En BDs ya existentes lo crea db._ensure_builtin_habit_index (create_all no
    # añade índices a tablas existentes).
    __table_args__ = (
        Index(
            "uq_habits_builtin_kind",
            "kind",
            unique=True,
            sqlite_where=text("kind IN ('water', 'steps')"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    kind: Mapped[str]  # water | steps | check | count
    target: Mapped[float | None] = mapped_column(nullable=True, default=None)
    unit: Mapped[str | None] = mapped_column(nullable=True, default=None)
    reminder_time: Mapped[str | None] = mapped_column(nullable=True, default=None)  # "HH:MM"
    active: Mapped[bool] = mapped_column(default=True)
    position: Mapped[int] = mapped_column(default=0)

    logs: Mapped[list["HabitLog"]] = relationship(cascade="all, delete-orphan")


class HabitLog(Base):
    """Registro diario de hábitos check/count. water y steps NO se registran aquí."""

    __tablename__ = "habit_logs"
    __table_args__ = (UniqueConstraint("habit_id", "date", name="uq_habit_logs_habit_date"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    habit_id: Mapped[int] = mapped_column(ForeignKey("habits.id", ondelete="CASCADE"))
    date: Mapped[date_]
    value: Mapped[float]


class StepsDay(Base):
    __tablename__ = "steps_days"

    date: Mapped[date_] = mapped_column(primary_key=True)
    steps: Mapped[int]
