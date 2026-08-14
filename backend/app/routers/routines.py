from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.schemas.routine import Routine, RoutineCreate
from app.services.superset import validate_superset_groups

router = APIRouter(prefix="/routines", tags=["routines"])


@router.get("", response_model=list[Routine])
def list_routines(db: Session = Depends(get_db)) -> list[models.Routine]:
    return db.query(models.Routine).order_by(models.Routine.id).all()


@router.post("", response_model=Routine, status_code=201)
def create_routine(payload: RoutineCreate, db: Session = Depends(get_db)) -> models.Routine:
    for item in payload.exercises:
        if db.get(models.Exercise, item.exercise_id) is None:
            raise HTTPException(status_code=404, detail=f"Exercise {item.exercise_id} not found")
    validate_superset_groups(payload.exercises)

    routine = models.Routine(
        name=payload.name,
        exercises=[models.RoutineExercise(**item.model_dump()) for item in payload.exercises],
    )
    db.add(routine)
    db.commit()
    db.refresh(routine)
    return routine


@router.get("/{routine_id}", response_model=Routine)
def get_routine(routine_id: int, db: Session = Depends(get_db)) -> models.Routine:
    routine = db.get(models.Routine, routine_id)
    if routine is None:
        raise HTTPException(status_code=404, detail="Routine not found")
    return routine


@router.put("/{routine_id}", response_model=Routine)
def update_routine(
    routine_id: int, payload: RoutineCreate, db: Session = Depends(get_db)
) -> models.Routine:
    routine = db.get(models.Routine, routine_id)
    if routine is None:
        raise HTTPException(status_code=404, detail="Routine not found")

    for item in payload.exercises:
        if db.get(models.Exercise, item.exercise_id) is None:
            raise HTTPException(status_code=404, detail=f"Exercise {item.exercise_id} not found")
    validate_superset_groups(payload.exercises)

    routine.name = payload.name
    routine.exercises = [models.RoutineExercise(**item.model_dump()) for item in payload.exercises]
    db.commit()
    db.refresh(routine)
    return routine


@router.delete("/{routine_id}", status_code=204)
def delete_routine(routine_id: int, db: Session = Depends(get_db)) -> None:
    routine = db.get(models.Routine, routine_id)
    if routine is None:
        raise HTTPException(status_code=404, detail="Routine not found")

    # ScheduleEntry.routine_id and Workout.routine_id use ondelete="SET NULL" at the
    # DB level (see app/models.py) — deleting the routine here lets SQLite null out
    # those references instead of blocking the delete. Requires PRAGMA foreign_keys=ON
    # per connection (already set in app/db.py's connect listener).
    db.delete(routine)
    db.commit()
