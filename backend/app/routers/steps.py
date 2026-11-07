from datetime import date as date_
from datetime import timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.schemas.steps import StepsDay, StepsUpsert

router = APIRouter(prefix="/steps", tags=["steps"])


@router.get("", response_model=list[StepsDay])
def list_steps(
    days: int = Query(default=7, ge=1, le=90),
    end: date_ | None = None,
    db: Session = Depends(get_db),
) -> list[StepsDay]:
    """Pasos de los últimos `days` días hasta `end` (inclusive; por defecto la
    fecha del servidor, el cliente debería pasarla), más reciente primero,
    incluyendo días sin registro (0)."""
    end = end or date_.today()
    start = end - timedelta(days=days - 1)
    rows = (
        db.query(models.StepsDay)
        .filter(models.StepsDay.date >= start, models.StepsDay.date <= end)
        .all()
    )
    by_date = {r.date: r.steps for r in rows}
    return [
        StepsDay(date=end - timedelta(days=i), steps=by_date.get(end - timedelta(days=i), 0))
        for i in range(days)
    ]


@router.put("/{day}", response_model=StepsDay)
def upsert_steps(day: date_, payload: StepsUpsert, db: Session = Depends(get_db)) -> models.StepsDay:
    """Upsert por día que conserva el máximo: el Pedometer solo crece durante el
    día, así que un valor menor (lectura vieja/reinstalación) nunca lo reduce."""
    row = db.get(models.StepsDay, day)
    if row is None:
        row = models.StepsDay(date=day, steps=payload.steps)
        db.add(row)
    elif payload.steps > row.steps:
        row.steps = payload.steps
    db.commit()
    db.refresh(row)
    return row
