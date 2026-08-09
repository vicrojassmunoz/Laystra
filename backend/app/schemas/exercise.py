from typing import Literal

from pydantic import BaseModel


class ExerciseBase(BaseModel):
    name: str
    unit: Literal["kg", "lb"] = "kg"


class ExerciseCreate(ExerciseBase):
    pass


class Exercise(ExerciseBase):
    id: int
