from datetime import date as date_

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import models

DEFAULT_STEPS_TARGET = 8000.0
DEFAULT_WATER_GOAL_ML = 2500
_BUILTINS = [
    # (kind, name, target, unit, position)
    ("water", "Agua", None, "ml", 0),
    ("steps", "Pasos", DEFAULT_STEPS_TARGET, "pasos", 1),
]


def ensure_builtin_habits(db: Session) -> None:
    """Siembra los hábitos integrados (water, steps) si no existe ninguno de ese
    kind. Idempotente; los integrados no se pueden borrar (409 en el router)."""
    existing = {k for (k,) in db.query(models.Habit.kind).filter(models.Habit.kind.in_(["water", "steps"]))}
    for kind, name, target, unit, position in _BUILTINS:
        if kind in existing:
            continue
        db.add(models.Habit(name=name, kind=kind, target=target, unit=unit, position=position))
        try:
            db.commit()
        except IntegrityError:
            # Carrera: otra petición sembró el mismo kind entre el SELECT y el
            # INSERT (índice único parcial uq_habits_builtin_kind). Ya existe: ok.
            db.rollback()


def resolve_progress(db: Session, habit: models.Habit, day: date_) -> tuple[float, float | None, bool]:
    """(progress, target, done) del hábito en `day`. water/steps se derivan de sus
    tablas (/water, /steps); check/count de HabitLog."""
    if habit.kind == "water":
        total = (
            db.query(func.coalesce(func.sum(models.WaterEntry.ml), 0))
            .filter(models.WaterEntry.date == day)
            .scalar()
        )
        settings = db.get(models.WaterSettings, 1)
        target: float | None = float(settings.goal_ml if settings else DEFAULT_WATER_GOAL_ML)
        progress = float(total)
    elif habit.kind == "steps":
        row = db.get(models.StepsDay, day)
        progress = float(row.steps) if row else 0.0
        target = habit.target if habit.target is not None else DEFAULT_STEPS_TARGET
    else:
        log = (
            db.query(models.HabitLog)
            .filter(models.HabitLog.habit_id == habit.id, models.HabitLog.date == day)
            .one_or_none()
        )
        progress = log.value if log else 0.0
        target = habit.target if habit.target is not None else (1.0 if habit.kind == "check" else None)
    done = progress >= target if target is not None else progress > 0
    return progress, target, done
