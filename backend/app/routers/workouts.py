import csv
import io

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session, selectinload

from app import models
from app.db import get_db
from app.schemas.workout import Workout, WorkoutCreate
from app.services.superset import validate_superset_groups

router = APIRouter(prefix="/workouts", tags=["workouts"])

_EXPORT_HEADER = ["date", "exercise", "weight", "reps", "set_order", "unit", "superset_group"]
_EXPORT_FILENAME = "laystra-workouts.csv"


@router.get("", response_model=list[Workout])
def list_workouts(db: Session = Depends(get_db)) -> list[models.Workout]:
    return db.query(models.Workout).order_by(models.Workout.date.desc(), models.Workout.id.desc()).all()


@router.post("", response_model=Workout, status_code=201)
def create_workout(payload: WorkoutCreate, db: Session = Depends(get_db)) -> models.Workout:
    if payload.routine_id is not None and db.get(models.Routine, payload.routine_id) is None:
        raise HTTPException(status_code=404, detail="Routine not found")
    for item in payload.sets:
        if db.get(models.Exercise, item.exercise_id) is None:
            raise HTTPException(status_code=404, detail=f"Exercise {item.exercise_id} not found")
    validate_superset_groups(payload.sets)

    workout = models.Workout(
        date=payload.date,
        routine_id=payload.routine_id,
        sets=[models.WorkoutSet(**item.model_dump()) for item in payload.sets],
    )
    db.add(workout)
    db.commit()
    db.refresh(workout)
    return workout


@router.get("/export")
def export_workouts(db: Session = Depends(get_db)) -> Response:
    """CSV plano (una fila por WorkoutSet) para backup/Excel. Declarado antes
    de GET /{workout_id} para que FastAPI no interprete "export" como id."""
    exercises_by_id: dict[int, models.Exercise] = {e.id: e for e in db.query(models.Exercise).all()}
    workouts = (
        db.query(models.Workout)
        .options(selectinload(models.Workout.sets))
        .order_by(models.Workout.date.desc(), models.Workout.id.desc())
        .all()
    )

    buffer = io.StringIO()
    writer = csv.writer(buffer, quoting=csv.QUOTE_MINIMAL)
    writer.writerow(_EXPORT_HEADER)
    for workout in workouts:
        for workout_set in workout.sets:
            exercise = exercises_by_id.get(workout_set.exercise_id)
            name = exercise.name if exercise is not None else f"Ejercicio #{workout_set.exercise_id}"
            unit = exercise.unit if exercise is not None else "kg"
            superset = "" if workout_set.superset_group is None else str(workout_set.superset_group)
            writer.writerow(
                [
                    workout.date.isoformat(),
                    name,
                    workout_set.weight,
                    workout_set.reps,
                    workout_set.order,
                    unit,
                    superset,
                ]
            )

    body = "\ufeff" + buffer.getvalue()
    return Response(
        content=body.encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{_EXPORT_FILENAME}"'},
    )


@router.get("/{workout_id}", response_model=Workout)
def get_workout(workout_id: int, db: Session = Depends(get_db)) -> models.Workout:
    workout = db.get(models.Workout, workout_id)
    if workout is None:
        raise HTTPException(status_code=404, detail="Workout not found")
    return workout


@router.put("/{workout_id}", response_model=Workout)
def update_workout(
    workout_id: int, payload: WorkoutCreate, db: Session = Depends(get_db)
) -> models.Workout:
    workout = db.get(models.Workout, workout_id)
    if workout is None:
        raise HTTPException(status_code=404, detail="Workout not found")

    if payload.routine_id is not None and db.get(models.Routine, payload.routine_id) is None:
        raise HTTPException(status_code=404, detail="Routine not found")
    for item in payload.sets:
        if db.get(models.Exercise, item.exercise_id) is None:
            raise HTTPException(status_code=404, detail=f"Exercise {item.exercise_id} not found")
    validate_superset_groups(payload.sets)

    workout.date = payload.date
    workout.routine_id = payload.routine_id
    workout.sets = [models.WorkoutSet(**item.model_dump()) for item in payload.sets]
    db.commit()
    db.refresh(workout)
    return workout


@router.delete("/{workout_id}", status_code=204)
def delete_workout(workout_id: int, db: Session = Depends(get_db)) -> None:
    workout = db.get(models.Workout, workout_id)
    if workout is None:
        raise HTTPException(status_code=404, detail="Workout not found")

    # Workout.sets uses cascade="all, delete-orphan" (see app/models.py), so
    # deleting the workout also deletes its WorkoutSet rows.
    db.delete(workout)
    db.commit()
