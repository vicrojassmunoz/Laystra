from pydantic import BaseModel


class MuscleGroupVolume(BaseModel):
    muscle_group: str
    tonnage: float


class MuscleGroupGap(BaseModel):
    muscle_group: str
    days_since_trained: int | None


class AnalyticsSummary(BaseModel):
    week_tonnage: float
    volume_by_muscle: list[MuscleGroupVolume]
    days_since_trained: list[MuscleGroupGap]
