from datetime import date as date_
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

BodyArea = Literal[
    "hombro", "codo", "muñeca", "espalda_alta", "lumbar", "cadera", "rodilla", "tobillo", "cuello", "otro"
]
Severity = Literal["leve", "moderada", "grave"]


class InjuryBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    body_area: BodyArea
    severity: Severity
    since: date_
    active: bool = True
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("title")
    @classmethod
    def _strip_title(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("title must not be blank")
        return stripped

    @field_validator("notes")
    @classmethod
    def _blank_notes_to_none(cls, value: str | None) -> str | None:
        return (value.strip() or None) if value is not None else None


class InjuryCreate(InjuryBase):
    pass


class Injury(InjuryBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
