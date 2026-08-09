from fastapi import APIRouter, HTTPException

from app.schemas.workout import Workout, WorkoutCreate, WorkoutSet
from app.services.store import store

router = APIRouter(prefix="/workouts", tags=["workouts"])


@router.get("", response_model=list[Workout])
def list_workouts() -> list[Workout]:
    return sorted(store.workouts.values(), key=lambda w: w.date, reverse=True)


@router.post("", response_model=Workout, status_code=201)
def create_workout(payload: WorkoutCreate) -> Workout:
    if payload.routine_id is not None and payload.routine_id not in store.routines:
        raise HTTPException(status_code=404, detail="Routine not found")
    for item in payload.sets:
        if item.exercise_id not in store.exercises:
            raise HTTPException(status_code=404, detail=f"Exercise {item.exercise_id} not found")

    workout_id = store.next_workout_id()
    sets = [
        WorkoutSet(id=store.next_workout_set_id(), workout_id=workout_id, **item.model_dump())
        for item in payload.sets
    ]
    workout = Workout(id=workout_id, date=payload.date, routine_id=payload.routine_id, sets=sets)
    store.workouts[workout_id] = workout
    return workout


@router.get("/{workout_id}", response_model=Workout)
def get_workout(workout_id: int) -> Workout:
    workout = store.workouts.get(workout_id)
    if workout is None:
        raise HTTPException(status_code=404, detail="Workout not found")
    return workout
