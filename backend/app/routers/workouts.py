from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.schemas.workout import Workout, WorkoutCreate

router = APIRouter(prefix="/workouts", tags=["workouts"])


@router.get("", response_model=list[Workout])
def list_workouts(db: Session = Depends(get_db)) -> list[models.Workout]:
    return db.query(models.Workout).order_by(models.Workout.date.desc(), models.Workout.id.desc()).all()


@router.post("", response_model=Workout, status_code=201)
def create_workout(payload: WorkoutCreate, db: Session = Depends(get_db)) -> models.Workout:
    if payload.routine_id is not None and db.get(models.Routine, payload.routine_id) is None:
        raise HTTPException(status_code=404, detail="Routine not found")
    for item in payload.sets:
        if db.get(models.Exercise, item.exercise_id) is None:
            raise HTTPException(status_code=404, detail=f"Exercise {item.exercise_id} not found")

    workout = models.Workout(
        date=payload.date,
        routine_id=payload.routine_id,
        sets=[models.WorkoutSet(**item.model_dump()) for item in payload.sets],
    )
    db.add(workout)
    db.commit()
    db.refresh(workout)
    return workout


@router.get("/{workout_id}", response_model=Workout)
def get_workout(workout_id: int, db: Session = Depends(get_db)) -> models.Workout:
    workout = db.get(models.Workout, workout_id)
    if workout is None:
        raise HTTPException(status_code=404, detail="Workout not found")
    return workout
