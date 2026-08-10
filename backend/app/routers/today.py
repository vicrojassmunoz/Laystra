from datetime import date as date_

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.schemas.today import TodayExercise, TodayResponse

router = APIRouter(tags=["today"])


@router.get("/today", response_model=TodayResponse)
def get_today(date: date_, db: Session = Depends(get_db)) -> TodayResponse:
    day_of_week = date.weekday()  # Monday = 0 ... Sunday = 6
    schedule_entry = db.query(models.ScheduleEntry).filter(models.ScheduleEntry.day == day_of_week).one_or_none()
    routine = None
    if schedule_entry is not None and schedule_entry.routine_id is not None:
        routine = db.get(models.Routine, schedule_entry.routine_id)

    exercises: list[TodayExercise] = []
    if routine is not None:
        for routine_exercise in sorted(routine.exercises, key=lambda re: re.order):
            exercise = db.get(models.Exercise, routine_exercise.exercise_id)
            exercises.append(
                TodayExercise(
                    exercise_id=exercise.id,
                    exercise_name=exercise.name,
                    unit=exercise.unit,
                    target_sets=routine_exercise.target_sets,
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
