from datetime import date as date_

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Exercise(Base):
    __tablename__ = "exercises"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str]
    unit: Mapped[str] = mapped_column(default="kg")


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
