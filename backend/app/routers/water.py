import csv
import io
from datetime import date as date_
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.schemas.water import (
    WaterContainer,
    WaterContainerCreate,
    WaterDay,
    WaterDayTotal,
    WaterEntry,
    WaterEntryCreate,
    WaterSettings,
)

router = APIRouter(prefix="/water", tags=["water"])

_DEFAULT_GOAL_ML = 2500
_DEFAULT_CONTAINERS = [("Vaso", 250), ("Taza", 300), ("Botella", 500), ("Botella grande", 1000)]
_EXPORT_HEADER = ["date", "ml", "container"]
_EXPORT_FILENAME = "laystra-water.csv"


def _get_settings(db: Session) -> models.WaterSettings:
    """Fila única de ajustes. La primera vez que se usa el módulo de agua
    también siembra los recipientes por defecto (y solo entonces: si el usuario
    los borra todos después, no reaparecen)."""
    settings = db.get(models.WaterSettings, 1)
    if settings is None:
        settings = models.WaterSettings(id=1, goal_ml=_DEFAULT_GOAL_ML)
        db.add(settings)
        db.add_all(models.WaterContainer(name=n, ml=ml) for n, ml in _DEFAULT_CONTAINERS)
        db.commit()
        db.refresh(settings)
    return settings


@router.get("/settings", response_model=WaterSettings)
def get_settings(db: Session = Depends(get_db)) -> models.WaterSettings:
    return _get_settings(db)


@router.put("/settings", response_model=WaterSettings)
def update_settings(payload: WaterSettings, db: Session = Depends(get_db)) -> models.WaterSettings:
    settings = _get_settings(db)
    settings.goal_ml = payload.goal_ml
    db.commit()
    db.refresh(settings)
    return settings


@router.get("/containers", response_model=list[WaterContainer])
def list_containers(db: Session = Depends(get_db)) -> list[models.WaterContainer]:
    _get_settings(db)
    return db.query(models.WaterContainer).order_by(models.WaterContainer.ml, models.WaterContainer.id).all()


@router.post("/containers", response_model=WaterContainer, status_code=201)
def create_container(payload: WaterContainerCreate, db: Session = Depends(get_db)) -> models.WaterContainer:
    _get_settings(db)
    container = models.WaterContainer(**payload.model_dump())
    db.add(container)
    db.commit()
    db.refresh(container)
    return container


@router.put("/containers/{container_id}", response_model=WaterContainer)
def update_container(
    container_id: int, payload: WaterContainerCreate, db: Session = Depends(get_db)
) -> models.WaterContainer:
    container = db.get(models.WaterContainer, container_id)
    if container is None:
        raise HTTPException(status_code=404, detail="Container not found")
    # Las entradas ya registradas guardan su propio ml: cambiar la capacidad solo
    # afecta a lo que se añada a partir de ahora.
    container.name = payload.name
    container.ml = payload.ml
    db.commit()
    db.refresh(container)
    return container


@router.delete("/containers/{container_id}", status_code=204)
def delete_container(container_id: int, db: Session = Depends(get_db)) -> None:
    container = db.get(models.WaterContainer, container_id)
    if container is None:
        raise HTTPException(status_code=404, detail="Container not found")
    db.delete(container)
    db.commit()


@router.get("", response_model=WaterDay)
def get_day(date: date_, db: Session = Depends(get_db)) -> WaterDay:
    settings = _get_settings(db)
    entries = (
        db.query(models.WaterEntry)
        .filter(models.WaterEntry.date == date)
        .order_by(models.WaterEntry.id)
        .all()
    )
    return WaterDay(
        date=date,
        total_ml=sum(e.ml for e in entries),
        goal_ml=settings.goal_ml,
        entries=[WaterEntry.model_validate(e) for e in entries],
    )


@router.post("/entries", response_model=WaterEntry, status_code=201)
def create_entry(payload: WaterEntryCreate, db: Session = Depends(get_db)) -> models.WaterEntry:
    entry = models.WaterEntry(**payload.model_dump())
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


@router.delete("/entries/{entry_id}", status_code=204)
def delete_entry(entry_id: int, db: Session = Depends(get_db)) -> None:
    entry = db.get(models.WaterEntry, entry_id)
    if entry is None:
        raise HTTPException(status_code=404, detail="Water entry not found")
    db.delete(entry)
    db.commit()


@router.get("/history", response_model=list[WaterDayTotal])
def get_history(
    end: date_, days: int = Query(default=7, ge=1, le=90), db: Session = Depends(get_db)
) -> list[WaterDayTotal]:
    """Total por día de los últimos `days` días hasta `end` (inclusive), más
    reciente primero, incluyendo días sin registros (total 0)."""
    start = end - timedelta(days=days - 1)
    rows = (
        db.query(models.WaterEntry.date, func.sum(models.WaterEntry.ml))
        .filter(models.WaterEntry.date >= start, models.WaterEntry.date <= end)
        .group_by(models.WaterEntry.date)
        .all()
    )
    totals = {d: int(total) for d, total in rows}
    return [
        WaterDayTotal(date=end - timedelta(days=i), total_ml=totals.get(end - timedelta(days=i), 0))
        for i in range(days)
    ]


@router.get("/export")
def export_water(db: Session = Depends(get_db)) -> Response:
    """CSV plano (una fila por entrada) para backup/Excel."""
    entries = db.query(models.WaterEntry).order_by(models.WaterEntry.date.desc(), models.WaterEntry.id.desc())
    buffer = io.StringIO()
    writer = csv.writer(buffer, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(_EXPORT_HEADER)
    for entry in entries:
        writer.writerow([entry.date.isoformat(), entry.ml, entry.container_name or ""])
    body = "﻿" + buffer.getvalue()
    return Response(
        content=body.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{_EXPORT_FILENAME}"'},
    )
