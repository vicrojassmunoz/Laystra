from typing import Literal

from pydantic import BaseModel, ConfigDict


class ExerciseBase(BaseModel):
    name: str
    unit: Literal["kg", "lb"] = "kg"


class ExerciseCreate(ExerciseBase):
    pass


class Exercise(ExerciseBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
