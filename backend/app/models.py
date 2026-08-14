from datetime import date as date_

from sqlalchemy import ForeignKey
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
    # Agrupa sets en un bloque de super-serie dentro de este workout ya logueado
    # (real o libre). Independiente de RoutineExercise.superset_group: un workout
    # libre no tiene RoutineExercise detrás, así que lo realmente ejecutado se
    # agrupa aparte. Nulo = set suelto. Ver ADD COLUMN idempotente en app/db.py.
    superset_group: Mapped[int | None] = mapped_column(nullable=True, default=None)

    workout: Mapped["Workout"] = relationship(back_populates="sets")
