from pydantic import BaseModel, ConfigDict, Field


class RoutineExerciseBase(BaseModel):
    exercise_id: int
    target_sets: int = Field(gt=0)
    order: int = Field(ge=0)
    # Nulo = ejercicio suelto. Mismo entero = mismo bloque de super-serie dentro
    # de esta rutina (solo comparable dentro de la misma rutina). Validado en el
    # router: un valor usado por menos de 2 exercise_id distintos es un 400.
    superset_group: int | None = None


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
