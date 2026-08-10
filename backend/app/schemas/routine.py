from pydantic import BaseModel, ConfigDict, Field


class RoutineExerciseBase(BaseModel):
    exercise_id: int
    target_sets: int = Field(gt=0)
    target_reps: int = Field(gt=0)
    order: int = Field(ge=0)


class RoutineExerciseCreate(RoutineExerciseBase):
    pass


class RoutineExercise(RoutineExerciseBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    routine_id: int


class RoutineBase(BaseModel):
    name: str


class RoutineCreate(RoutineBase):
    exercises: list[RoutineExerciseCreate] = []


class Routine(RoutineBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    exercises: list[RoutineExercise] = []
