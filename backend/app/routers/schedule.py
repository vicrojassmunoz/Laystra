from fastapi import APIRouter, Depends, HTTPException, Path
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.schemas.schedule import ScheduleEntry, ScheduleUpdate

router = APIRouter(prefix="/schedule", tags=["schedule"])


@router.get("", response_model=list[ScheduleEntry])
def get_schedule(db: Session = Depends(get_db)) -> list[ScheduleEntry]:
    entries = db.query(models.ScheduleEntry).order_by(models.ScheduleEntry.day).all()
    routine_by_day = {entry.day: entry.routine_id for entry in entries}
    return [ScheduleEntry(day=day, routine_id=routine_by_day.get(day)) for day in range(7)]


@router.put("/{day}", response_model=ScheduleEntry)
def set_schedule_day(
    payload: ScheduleUpdate,
    day: int = Path(ge=0, le=6),
    db: Session = Depends(get_db),
) -> ScheduleEntry:
    if payload.routine_id is not None and db.get(models.Routine, payload.routine_id) is None:
        raise HTTPException(status_code=404, detail="Routine not found")

    entry = db.query(models.ScheduleEntry).filter(models.ScheduleEntry.day == day).one_or_none()
    if entry is None:
        entry = models.ScheduleEntry(day=day, routine_id=payload.routine_id)
        db.add(entry)
    else:
        entry.routine_id = payload.routine_id
    db.commit()

    return ScheduleEntry(day=day, routine_id=payload.routine_id)
