from fastapi import APIRouter, HTTPException

from app.schemas.schedule import ScheduleEntry, ScheduleUpdate
from app.services.store import store

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("", response_model=list[ScheduleEntry])
def get_schedule() -> list[ScheduleEntry]:
    return [ScheduleEntry(day=day, routine_id=routine_id) for day, routine_id in sorted(store.schedule.items())]


@router.put("/{day}", response_model=ScheduleEntry)
def set_schedule_day(day: int, payload: ScheduleUpdate) -> ScheduleEntry:
    if day not in store.schedule:
        raise HTTPException(status_code=422, detail="day must be between 0 (Monday) and 6 (Sunday)")
    if payload.routine_id is not None and payload.routine_id not in store.routines:
        raise HTTPException(status_code=404, detail="Routine not found")

    store.schedule[day] = payload.routine_id
    return ScheduleEntry(day=day, routine_id=payload.routine_id)
