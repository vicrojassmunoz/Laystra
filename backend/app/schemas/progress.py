from datetime import date as date_

from pydantic import BaseModel


class ProgressPoint(BaseModel):
    date: date_
    workout_id: int
    best_weight: float
    total_reps: int
    unit: str
    # Mejor serie del día por volumen (peso×reps), normalizado a kg para poder
    # comparar entre sesiones aunque la unidad cambie. "bw" cuenta como kg.
    best_set_volume_kg: float = 0.0


class ProgressResponse(BaseModel):
    exercise_id: int
    exercise_name: str
    points: list[ProgressPoint]
