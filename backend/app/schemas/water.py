from datetime import date as date_

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Tope por entrada/recipiente: evita typos (5000 en vez de 500) sin ser restrictivo.
MAX_WATER_ML = 5000


class WaterContainerBase(BaseModel):
    name: str = Field(min_length=1, max_length=40)
    ml: int = Field(ge=1, le=MAX_WATER_ML)

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("name must not be blank")
        return stripped


class WaterContainerCreate(WaterContainerBase):
    pass


class WaterContainer(WaterContainerBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class WaterEntryCreate(BaseModel):
    date: date_
    ml: int = Field(ge=1, le=MAX_WATER_ML)
    # Nombre del recipiente usado, solo informativo (None = cantidad directa en ml).
    container_name: str | None = Field(default=None, max_length=40)


class WaterEntry(WaterEntryCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int


class WaterDay(BaseModel):
    date: date_
    total_ml: int
    goal_ml: int
    entries: list[WaterEntry]


class WaterDayTotal(BaseModel):
    date: date_
    total_ml: int


class WaterSettings(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    goal_ml: int = Field(ge=100, le=20000)
