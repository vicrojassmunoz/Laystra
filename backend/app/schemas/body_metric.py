from datetime import date as date_

from pydantic import BaseModel, ConfigDict, Field


class BodyMetricBase(BaseModel):
    date: date_
    weight: float = Field(gt=0)
    body_fat_pct: float | None = Field(default=None, ge=0, le=100)


class BodyMetricCreate(BodyMetricBase):
    pass


class BodyMetric(BodyMetricBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
