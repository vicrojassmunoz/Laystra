from fastapi import APIRouter, HTTPException

from app.schemas.routine import Routine, RoutineCreate, RoutineExercise
from app.services.store import store

router = APIRouter(prefix="/routines", tags=["routines"])


@router.get("", response_model=list[Routine])
def list_routines() -> list[Routine]:
    return list(store.routines.values())


@router.post("", response_model=Routine, status_code=201)
def create_routine(payload: RoutineCreate) -> Routine:
    for item in payload.exercises:
        if item.exercise_id not in store.exercises:
            raise HTTPException(status_code=404, detail=f"Exercise {item.exercise_id} not found")

    routine_id = store.next_routine_id()
    exercises = [
        RoutineExercise(
            id=store.next_routine_exercise_id(),
            routine_id=routine_id,
            **item.model_dump(),
        )
        for item in payload.exercises
    ]
    routine = Routine(id=routine_id, name=payload.name, exercises=exercises)
    store.routines[routine_id] = routine
    return routine


@router.get("/{routine_id}", response_model=Routine)
def get_routine(routine_id: int) -> Routine:
    routine = store.routines.get(routine_id)
    if routine is None:
        raise HTTPException(status_code=404, detail="Routine not found")
    return routine
