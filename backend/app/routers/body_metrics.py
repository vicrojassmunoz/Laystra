from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.schemas.body_metric import BodyMetric, BodyMetricCreate

router = APIRouter(prefix="/body-metrics", tags=["body-metrics"])


@router.get("", response_model=list[BodyMetric])
def list_body_metrics(db: Session = Depends(get_db)) -> list[models.BodyMetric]:
    return (
        db.query(models.BodyMetric)
        .order_by(models.BodyMetric.date.desc(), models.BodyMetric.id.desc())
        .all()
    )


@router.post("", response_model=BodyMetric, status_code=201)
def create_body_metric(payload: BodyMetricCreate, db: Session = Depends(get_db)) -> models.BodyMetric:
    metric = models.BodyMetric(**payload.model_dump())
    db.add(metric)
    db.commit()
    db.refresh(metric)
    return metric


@router.delete("/{body_metric_id}", status_code=204)
def delete_body_metric(body_metric_id: int, db: Session = Depends(get_db)) -> None:
    metric = db.get(models.BodyMetric, body_metric_id)
    if metric is None:
        raise HTTPException(status_code=404, detail="Body metric not found")

    db.delete(metric)
    db.commit()
