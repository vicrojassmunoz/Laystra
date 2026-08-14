from sqlalchemy.orm import Session

from app import models
from app.muscle_taxonomy import EXERCISE_MUSCLE_GROUPS


def _exercise(name: str, unit: str = "kg") -> models.Exercise:
    """Construye un Exercise ya clasificado por grupo muscular a partir del
    catálogo compartido en app/muscle_taxonomy.py — una DB nueva (tests, dev
    limpio) nace clasificada sin depender del backfill ad-hoc de app/db.py,
    que existe solo para laystra.db en producción (tenía estas filas ya
    insertadas antes de que este campo existiera)."""
    primary, secondaries = EXERCISE_MUSCLE_GROUPS[name]
    return models.Exercise(
        name=name,
        unit=unit,
        muscle_group_primary=primary,
        secondary_muscles=[models.ExerciseSecondaryMuscle(muscle_group=m) for m in secondaries],
    )


def seed_if_empty(db: Session) -> None:
    """Fase 1 dev seed — same example data the old InMemoryStore shipped with.

    Only runs against a genuinely empty DB (no exercises yet), so it's safe to call
    on every app startup / test setup without duplicating rows.
    """
    if db.query(models.Exercise).first() is not None:
        return

    bench = _exercise("Press banca")
    squat = _exercise("Sentadilla")
    deadlift = _exercise("Peso muerto")
    pullup = _exercise("Dominadas")
    row = _exercise("Remo con barra")
    db.add_all([bench, squat, deadlift, pullup, row])

    # Ejercicios reales que el usuario entrena actualmente (lista dada 2026-08-10).
    # "Dominadas" ya existe arriba, no se duplica aquí.
    db.add_all(
        [
            _exercise("Remo mancuerna unilateral"),
            _exercise("Flexiones"),
            _exercise("Pullover"),
            _exercise("Curl martillo"),
            _exercise("Remo con goma cerrado unilateral"),
            _exercise("Facepull"),
            _exercise("Fondos"),
            _exercise("Press inclinado unilateral"),
            _exercise("Elevaciones laterales"),
            _exercise("Curl con goma"),
            _exercise("Flexiones declinadas con goma"),
            _exercise("Triceps sobre cabeza"),
            _exercise("Sentadilla búlgara"),
            _exercise("Curl femoral goma"),
            _exercise("Goblet squat"),
            _exercise("Peso muerto rumano"),
            _exercise("Gemelo de pie"),
            _exercise("Plancha (abdomen)"),
            _exercise("Swings con kettlebell"),
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
