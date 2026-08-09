from datetime import date as date_

from pydantic import BaseModel


class TodayExercise(BaseModel):
    exercise_id: int
    exercise_name: str
    unit: str
    target_sets: int
    target_reps: int
    order: int


class TodayResponse(BaseModel):
    date: date_
    day_of_week: int
    routine_id: int | None
    routine_name: str | None
    exercises: list[TodayExercise]
