from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.schemas.injury import Injury, InjuryCreate

router = APIRouter(prefix="/injuries", tags=["injuries"])


@router.get("", response_model=list[Injury])
def list_injuries(active: bool | None = None, db: Session = Depends(get_db)) -> list[models.Injury]:
    query = db.query(models.Injury)
    if active is not None:
        query = query.filter(models.Injury.active == active)
    return query.order_by(models.Injury.id).all()


@router.post("", response_model=Injury, status_code=201)
def create_injury(payload: InjuryCreate, db: Session = Depends(get_db)) -> models.Injury:
    injury = models.Injury(**payload.model_dump())
    db.add(injury)
    db.commit()
    db.refresh(injury)
    return injury


@router.get("/{injury_id}", response_model=Injury)
def get_injury(injury_id: int, db: Session = Depends(get_db)) -> models.Injury:
    injury = db.get(models.Injury, injury_id)
    if injury is None:
        raise HTTPException(status_code=404, detail="Injury not found")
    return injury


@router.put("/{injury_id}", response_model=Injury)
def update_injury(injury_id: int, payload: InjuryCreate, db: Session = Depends(get_db)) -> models.Injury:
    injury = db.get(models.Injury, injury_id)
    if injury is None:
        raise HTTPException(status_code=404, detail="Injury not found")
    for key, value in payload.model_dump().items():
        setattr(injury, key, value)
    db.commit()
    db.refresh(injury)
    return injury


@router.delete("/{injury_id}", status_code=204)
def delete_injury(injury_id: int, db: Session = Depends(get_db)) -> None:
    injury = db.get(models.Injury, injury_id)
    if injury is None:
        raise HTTPException(status_code=404, detail="Injury not found")
    db.delete(injury)
    db.commit()
