from datetime import date as date_

from pydantic import BaseModel, ConfigDict, Field

from app.units import WeightUnit


class WorkoutSetBase(BaseModel):
    exercise_id: int
    weight: float = Field(ge=0)
    reps: int = Field(ge=0)
    order: int = Field(ge=0)
    # None al crear = usar Exercise.unit (default del catálogo). En respuesta
    # es la instantánea del día, no se reescribe si luego cambia el ejercicio.
    unit: WeightUnit | None = None
    # Nulo = set suelto. Mismo entero = mismo bloque de super-serie dentro de
    # este workout (solo comparable dentro del mismo workout). Validado en el
    # router: un valor usado por menos de 2 exercise_id distintos es un 400.
    superset_group: int | None = None


class WorkoutSetCreate(WorkoutSetBase):
    pass


class WorkoutSet(WorkoutSetBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    workout_id: int


class WorkoutBase(BaseModel):
    date: date_
    routine_id: int | None = None


class WorkoutCreate(WorkoutBase):
    sets: list[WorkoutSetCreate] = []


class Workout(WorkoutBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sets: list[WorkoutSet] = []
