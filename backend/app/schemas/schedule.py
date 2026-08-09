from pydantic import BaseModel


class ScheduleEntry(BaseModel):
    day: int  # 0 = Monday ... 6 = Sunday (Python date.weekday() convention)
    routine_id: int | None


class ScheduleUpdate(BaseModel):
    routine_id: int | None
