from datetime import date as date_

from pydantic import BaseModel, Field


class WorkoutSetBase(BaseModel):
    exercise_id: int
    weight: float = Field(ge=0)
    reps: int = Field(ge=0)
    order: int = Field(ge=0)


class WorkoutSetCreate(WorkoutSetBase):
    pass


class WorkoutSet(WorkoutSetBase):
    id: int
    workout_id: int


class WorkoutBase(BaseModel):
    date: date_
    routine_id: int | None = None


class WorkoutCreate(WorkoutBase):
    sets: list[WorkoutSetCreate] = []


class Workout(WorkoutBase):
    id: int
    sets: list[WorkoutSet] = []
