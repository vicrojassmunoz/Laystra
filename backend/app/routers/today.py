from datetime import date as date_

from fastapi import APIRouter

from app.schemas.today import TodayExercise, TodayResponse
from app.services.store import store

router = APIRouter(tags=["today"])


@router.get("/today", response_model=TodayResponse)
def get_today(date: date_) -> TodayResponse:
    day_of_week = date.weekday()  # Monday = 0 ... Sunday = 6
    routine_id = store.schedule.get(day_of_week)
    routine = store.routines.get(routine_id) if routine_id is not None else None

    exercises: list[TodayExercise] = []
    if routine is not None:
        for routine_exercise in sorted(routine.exercises, key=lambda re: re.order):
            exercise = store.exercises[routine_exercise.exercise_id]
            exercises.append(
                TodayExercise(
                    exercise_id=exercise.id,
                    exercise_name=exercise.name,
                    unit=exercise.unit,
                    target_sets=routine_exercise.target_sets,
                    target_reps=routine_exercise.target_reps,
                    order=routine_exercise.order,
                )
            )

    return TodayResponse(
        date=date,
        day_of_week=day_of_week,
        routine_id=routine.id if routine else None,
        routine_name=routine.name if routine else None,
        exercises=exercises,
    )
