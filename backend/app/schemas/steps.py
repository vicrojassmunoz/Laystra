from datetime import date as date_

from pydantic import BaseModel, ConfigDict, Field


class StepsUpsert(BaseModel):
    steps: int = Field(ge=0, le=500_000)


class StepsDay(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    date: date_
    steps: int
