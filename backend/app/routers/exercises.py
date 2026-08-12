from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.schemas.exercise import Exercise, ExerciseCreate
from app.schemas.progress import ProgressPoint, ProgressResponse

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[Exercise])
def list_exercises(db: Session = Depends(get_db)) -> list[models.Exercise]:
    return db.query(models.Exercise).order_by(models.Exercise.id).all()


@router.post("", response_model=Exercise, status_code=201)
def create_exercise(payload: ExerciseCreate, db: Session = Depends(get_db)) -> models.Exercise:
    exercise = models.Exercise(**payload.model_dump())
    db.add(exercise)
    db.commit()
    db.refresh(exercise)
    return exercise


@router.get("/{exercise_id}/progress", response_model=ProgressResponse)
def get_exercise_progress(exercise_id: int, db: Session = Depends(get_db)) -> ProgressResponse:
    exercise = db.get(models.Exercise, exercise_id)
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")

    workouts = (
        db.query(models.Workout)
        .order_by(models.Workout.date, models.Workout.id)
        .all()
    )
    points: list[ProgressPoint] = []
    for workout in workouts:
        matching_sets = [s for s in workout.sets if s.exercise_id == exercise_id]
        if not matching_sets:
            continue
        points.append(
            ProgressPoint(
                date=workout.date,
                workout_id=workout.id,
                best_weight=max(s.weight for s in matching_sets),
                total_reps=sum(s.reps for s in matching_sets),
            )
        )

    return ProgressResponse(exercise_id=exercise.id, exercise_name=exercise.name, points=points)
