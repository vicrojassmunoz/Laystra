from fastapi import APIRouter, HTTPException

from app.schemas.exercise import Exercise, ExerciseCreate
from app.schemas.progress import ProgressPoint, ProgressResponse
from app.services.store import store

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=list[Exercise])
def list_exercises() -> list[Exercise]:
    return list(store.exercises.values())


@router.post("", response_model=Exercise, status_code=201)
def create_exercise(payload: ExerciseCreate) -> Exercise:
    exercise = Exercise(id=store.next_exercise_id(), **payload.model_dump())
    store.exercises[exercise.id] = exercise
    return exercise


@router.get("/{exercise_id}/progress", response_model=ProgressResponse)
def get_exercise_progress(exercise_id: int) -> ProgressResponse:
    exercise = store.exercises.get(exercise_id)
    if exercise is None:
        raise HTTPException(status_code=404, detail="Exercise not found")

    points: list[ProgressPoint] = []
    for workout in sorted(store.workouts.values(), key=lambda w: w.date):
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
