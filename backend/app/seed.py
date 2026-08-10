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

    # Ejercicios reales que el usuario entrena actualmente (lista dada 2026-08-10).
    # "Dominadas" ya existe arriba, no se duplica aquí.
    db.add_all(
        [
            models.Exercise(name="Remo mancuerna unilateral", unit="kg"),
            models.Exercise(name="Flexiones", unit="kg"),
            models.Exercise(name="Pullover", unit="kg"),
            models.Exercise(name="Curl martillo", unit="kg"),
            models.Exercise(name="Remo con goma cerrado unilateral", unit="kg"),
            models.Exercise(name="Facepull", unit="kg"),
            models.Exercise(name="Fondos", unit="kg"),
            models.Exercise(name="Press inclinado unilateral", unit="kg"),
            models.Exercise(name="Elevaciones laterales", unit="kg"),
            models.Exercise(name="Curl con goma", unit="kg"),
            models.Exercise(name="Flexiones declinadas con goma", unit="kg"),
            models.Exercise(name="Triceps sobre cabeza", unit="kg"),
            models.Exercise(name="Sentadilla búlgara", unit="kg"),
            models.Exercise(name="Curl femoral goma", unit="kg"),
            models.Exercise(name="Goblet squat", unit="kg"),
            models.Exercise(name="Peso muerto rumano", unit="kg"),
            models.Exercise(name="Gemelo de pie", unit="kg"),
            models.Exercise(name="Plancha (abdomen)", unit="kg"),
            models.Exercise(name="Swings con kettlebell", unit="kg"),
        ]
    )
    db.flush()  # assign ids before we reference them below

    push = models.Routine(
        name="Push day",
        exercises=[
            models.RoutineExercise(exercise_id=bench.id, target_sets=4, order=0),
            models.RoutineExercise(exercise_id=row.id, target_sets=3, order=1),
        ],
    )
    leg = models.Routine(
        name="Pierna",
        exercises=[
            models.RoutineExercise(exercise_id=squat.id, target_sets=4, order=0),
            models.RoutineExercise(exercise_id=deadlift.id, target_sets=3, order=1),
            models.RoutineExercise(exercise_id=pullup.id, target_sets=3, order=2),
        ],
    )
    db.add_all([push, leg])
    db.flush()

    for day in range(7):
        routine_id = push.id if day == 0 else leg.id if day == 2 else None
        db.add(models.ScheduleEntry(day=day, routine_id=routine_id))

    db.commit()
