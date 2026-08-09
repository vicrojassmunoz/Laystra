from datetime import date as date_

from pydantic import BaseModel


class ProgressPoint(BaseModel):
    date: date_
    workout_id: int
    best_weight: float
    total_reps: int


class ProgressResponse(BaseModel):
    exercise_id: int
    exercise_name: str
    points: list[ProgressPoint]
