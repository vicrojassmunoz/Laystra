from sqlalchemy.orm import Session

from app import models


def seed_if_empty(db: Session) -> None:
    """Fase 1 dev seed — same example data the old InMemoryStore shipped with.

    Only runs against a genuinely empty DB (no exercises yet), so it's safe to call
    on every app startup / test setup without duplicating rows.
    """
    if db.query(models.Exercise).first() is not None:
        return

    bench = models.Exercise(name="Press banca", unit="kg")
    squat = models.Exercise(name="Sentadilla", unit="kg")
    deadlift = models.Exercise(name="Peso muerto", unit="kg")
    pullup = models.Exercise(name="Dominadas", unit="kg")
    row = models.Exercise(name="Remo con barra", unit="kg")
    db.add_all([bench, squat, deadlift, pullup, row])
    db.flush()  # assign ids before we reference them below

    push = models.Routine(
        name="Push day",
        exercises=[
            models.RoutineExercise(exercise_id=bench.id, target_sets=4, target_reps=8, order=0),
            models.RoutineExercise(exercise_id=row.id, target_sets=3, target_reps=10, order=1),
        ],
    )
    leg = models.Routine(
        name="Pierna",
        exercises=[
            models.RoutineExercise(exercise_id=squat.id, target_sets=4, target_reps=6, order=0),
            models.RoutineExercise(exercise_id=deadlift.id, target_sets=3, target_reps=5, order=1),
            models.RoutineExercise(exercise_id=pullup.id, target_sets=3, target_reps=8, order=2),
        ],
    )
    db.add_all([push, leg])
    db.flush()

    for day in range(7):
        routine_id = push.id if day == 0 else leg.id if day == 2 else None
        db.add(models.ScheduleEntry(day=day, routine_id=routine_id))

    db.commit()
