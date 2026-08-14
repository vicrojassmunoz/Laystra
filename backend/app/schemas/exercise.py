from typing import Literal

from pydantic import BaseModel, ConfigDict

MuscleGroup = Literal[
    "Pecho",
    "Espalda",
    "Hombros",
    "Bíceps",
    "Tríceps",
    "Piernas",
    "Core",
    "Cardio / Otros",
]


class ExerciseBase(BaseModel):
    name: str
    unit: Literal["kg", "lb"] = "kg"
    muscle_group_secondary: list[MuscleGroup] = []


class ExerciseCreate(ExerciseBase):
    # Obligatorio al crear: no se puede dar de alta un ejercicio sin clasificar.
    muscle_group_primary: MuscleGroup


class Exercise(ExerciseBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    # Nullable en la respuesta (a diferencia de ExerciseCreate): un ejercicio
    # "viejo" backfilleado por nombre (ver _backfill_muscle_groups en app/db.py)
    # puede quedarse permanentemente sin clasificar si su nombre no está en
    # EXERCISE_MUSCLE_GROUPS. Si este campo fuera obligatorio aquí, esa única
    # fila haría fallar la serialización de list[Exercise] entero (500 en
    # GET /exercises) en vez de devolver null solo para esa fila.
    muscle_group_primary: MuscleGroup | None
