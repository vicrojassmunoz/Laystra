from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session, selectinload

from app import models
from app.db import get_db
from app.muscle_taxonomy import MUSCLE_GROUPS
from app.schemas.analytics import AnalyticsSummary, MuscleGroupGap, MuscleGroupVolume

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/summary", response_model=AnalyticsSummary)
def get_analytics_summary(db: Session = Depends(get_db)) -> AnalyticsSummary:
    exercises_by_id: dict[int, models.Exercise] = {e.id: e for e in db.query(models.Exercise).all()}

    today = date.today()
    week_start = today - timedelta(days=6)

    tonnage_by_group: dict[str, float] = {group: 0.0 for group in MUSCLE_GROUPS}
    week_tonnage = 0.0
    latest_date_by_group: dict[str, date] = {}

    workouts = (
        db.query(models.Workout).options(selectinload(models.Workout.sets)).all()
    )
    for workout in workouts:
        if workout.date > today:
            # Fecha futura (alcanzable vía POST /workouts, que no la valida):
            # se ignora por completo, no solo se clampa.
            continue

        in_week = workout.date >= week_start
        for workout_set in workout.sets:
            exercise = exercises_by_id.get(workout_set.exercise_id)
            group = exercise.muscle_group_primary if exercise is not None else None
            tonnage = workout_set.weight * workout_set.reps

            if in_week:
                week_tonnage += tonnage

            if group is None:
                # No clasificado: cuenta para week_tonnage (arriba) pero no
                # para ningún volume_by_muscle/days_since_trained por grupo.
                continue

            if group in latest_date_by_group:
                latest_date_by_group[group] = max(latest_date_by_group[group], workout.date)
            else:
                latest_date_by_group[group] = workout.date

            if in_week:
                tonnage_by_group[group] = tonnage_by_group.get(group, 0.0) + tonnage

    volume_by_muscle = [
        MuscleGroupVolume(muscle_group=group, tonnage=tonnage_by_group.get(group, 0.0))
        for group in MUSCLE_GROUPS
    ]
    days_since_trained = [
        MuscleGroupGap(
            muscle_group=group,
            days_since_trained=(today - latest_date_by_group[group]).days
            if group in latest_date_by_group
            else None,
        )
        for group in MUSCLE_GROUPS
    ]

    return AnalyticsSummary(
        week_tonnage=week_tonnage,
        volume_by_muscle=volume_by_muscle,
        days_since_trained=days_since_trained,
    )
