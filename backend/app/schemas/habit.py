import re
from datetime import date as date_
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

HabitKind = Literal["water", "steps", "check", "count"]
_HHMM = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class HabitBase(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    kind: HabitKind
    target: float | None = Field(default=None, gt=0)
    unit: str | None = Field(default=None, max_length=30)
    reminder_time: str | None = None
    active: bool = True
    position: int = Field(default=0, ge=0)

    @model_validator(mode="after")
    def _target_by_kind(self) -> "HabitBase":
        # check es binario (meta implícita 1); la meta de water sale de WaterSettings.
        if self.kind in ("check", "water") and self.target is not None:
            raise ValueError(f"target must be null for kind={self.kind}")
        return self

    @field_validator("name")
    @classmethod
    def _strip_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("name must not be blank")
        return stripped

    @field_validator("unit")
    @classmethod
    def _blank_unit_to_none(cls, value: str | None) -> str | None:
        return (value.strip() or None) if value is not None else None

    @field_validator("reminder_time")
    @classmethod
    def _check_hhmm(cls, value: str | None) -> str | None:
        if value is not None and not _HHMM.match(value):
            raise ValueError('reminder_time must be "HH:MM" (00:00-23:59)')
        return value


class HabitCreate(HabitBase):
    pass


class Habit(HabitBase):
    model_config = ConfigDict(from_attributes=True)

    id: int


class HabitProgress(BaseModel):
    habit: Habit
    progress: float
    target: float | None
    done: bool


class HabitLogUpsert(BaseModel):
    date: date_
    value: float = Field(ge=0, le=1_000_000)
