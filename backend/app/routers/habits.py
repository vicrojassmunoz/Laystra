from datetime import date as date_

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.schemas.habit import Habit, HabitCreate, HabitLogUpsert, HabitProgress
from app.services.habits import ensure_builtin_habits, resolve_progress

router = APIRouter(prefix="/habits", tags=["habits"])

_INTEGRATED = {"water", "steps"}


def _ordered(db: Session):
    return db.query(models.Habit).order_by(models.Habit.position, models.Habit.id)


def _get_or_404(db: Session, habit_id: int) -> models.Habit:
    habit = db.get(models.Habit, habit_id)
    if habit is None:
        raise HTTPException(status_code=404, detail="Habit not found")
    return habit


def _progress(db: Session, habit: models.Habit, day: date_) -> HabitProgress:
    progress, target, done = resolve_progress(db, habit, day)
    return HabitProgress(habit=Habit.model_validate(habit), progress=progress, target=target, done=done)


@router.get("", response_model=list[Habit])
def list_habits(db: Session = Depends(get_db)) -> list[models.Habit]:
    ensure_builtin_habits(db)
    return _ordered(db).all()


@router.get("/today", response_model=list[HabitProgress])
def habits_today(date: date_, db: Session = Depends(get_db)) -> list[HabitProgress]:
    """Hábitos activos con su progreso en `date` (el cliente pasa su "hoy")."""
    ensure_builtin_habits(db)
    return [_progress(db, h, date) for h in _ordered(db).filter(models.Habit.active.is_(True)).all()]


@router.post("", response_model=Habit, status_code=201)
def create_habit(payload: HabitCreate, db: Session = Depends(get_db)) -> models.Habit:
    ensure_builtin_habits(db)
    if payload.kind in _INTEGRATED:
        raise HTTPException(status_code=409, detail=f"Habit of kind {payload.kind} already exists")
    habit = models.Habit(**payload.model_dump())
    db.add(habit)
    db.commit()
    db.refresh(habit)
    return habit


@router.get("/{habit_id}", response_model=Habit)
def get_habit(habit_id: int, db: Session = Depends(get_db)) -> models.Habit:
    return _get_or_404(db, habit_id)


@router.put("/{habit_id}", response_model=Habit)
def update_habit(habit_id: int, payload: HabitCreate, db: Session = Depends(get_db)) -> models.Habit:
    habit = _get_or_404(db, habit_id)
    if payload.kind != habit.kind:
        raise HTTPException(status_code=409, detail="Habit kind cannot be changed")
    for key, value in payload.model_dump().items():
        setattr(habit, key, value)
    db.commit()
    db.refresh(habit)
    return habit


@router.delete("/{habit_id}", status_code=204)
def delete_habit(habit_id: int, db: Session = Depends(get_db)) -> None:
    habit = _get_or_404(db, habit_id)
    if habit.kind in _INTEGRATED:
        raise HTTPException(status_code=409, detail="Integrated habits cannot be deleted; deactivate instead")
    db.delete(habit)  # cascade borra sus HabitLog
    db.commit()


@router.put("/{habit_id}/log", response_model=HabitProgress)
def log_habit(habit_id: int, payload: HabitLogUpsert, db: Session = Depends(get_db)) -> HabitProgress:
    """Upsert del valor del día (check: 0|1; count: >=0). Devuelve el progreso
    resultante de ese día."""
    habit = _get_or_404(db, habit_id)
    if habit.kind in _INTEGRATED:
        source = "/water" if habit.kind == "water" else "/steps"
        raise HTTPException(status_code=409, detail=f"{habit.kind} progress is derived from {source}")
    if habit.kind == "check" and payload.value not in (0, 1):
        raise HTTPException(status_code=422, detail="check habits accept value 0 or 1")

    log = (
        db.query(models.HabitLog)
        .filter(models.HabitLog.habit_id == habit_id, models.HabitLog.date == payload.date)
        .one_or_none()
    )
    if log is None:
        db.add(models.HabitLog(habit_id=habit_id, date=payload.date, value=payload.value))
    else:
        log.value = payload.value
    db.commit()
    return _progress(db, habit, payload.date)
