"""Catálogo cerrado de grupos musculares y clasificación por ejercicio.

Fuente única de verdad para esta taxonomía: la importan tanto app/seed.py (para
poblar una DB nueva ya clasificada) como app/db.py (para el backfill ad-hoc
contra laystra.db en producción, que tenía estos 24 ejercicios ya insertados
antes de que este campo existiera). No dupliques estos datos en otro sitio.
"""

MUSCLE_GROUPS: list[str] = [
    "Pecho",
    "Espalda",
    "Hombros",
    "Bíceps",
    "Tríceps",
    "Piernas",
    "Core",
    "Cardio / Otros",
]

# nombre de ejercicio (match exacto contra el string ya usado en app/seed.py) ->
# (grupo muscular principal, [grupos musculares secundarios])
EXERCISE_MUSCLE_GROUPS: dict[str, tuple[str, list[str]]] = {
    "Press banca": ("Pecho", ["Tríceps", "Hombros"]),
    "Sentadilla": ("Piernas", ["Core"]),
    "Peso muerto": ("Espalda", ["Piernas"]),
    "Dominadas": ("Espalda", ["Bíceps"]),
    "Remo con barra": ("Espalda", ["Bíceps"]),
    "Remo mancuerna unilateral": ("Espalda", ["Bíceps"]),
    "Flexiones": ("Pecho", ["Tríceps", "Hombros"]),
    "Pullover": ("Espalda", []),
    "Curl martillo": ("Bíceps", []),
    "Remo con goma cerrado unilateral": ("Espalda", ["Bíceps"]),
    "Facepull": ("Hombros", ["Espalda"]),
    "Fondos": ("Tríceps", ["Pecho"]),
    "Press inclinado unilateral": ("Pecho", ["Tríceps", "Hombros"]),
    "Elevaciones laterales": ("Hombros", []),
    "Curl con goma": ("Bíceps", []),
    "Flexiones declinadas con goma": ("Pecho", ["Tríceps", "Hombros"]),
    # Sin tilde a propósito: es el string exacto ya presente en app/seed.py.
    "Triceps sobre cabeza": ("Tríceps", []),
    "Sentadilla búlgara": ("Piernas", ["Core"]),
    "Curl femoral goma": ("Piernas", []),
    "Goblet squat": ("Piernas", ["Core"]),
    "Peso muerto rumano": ("Piernas", []),
    "Gemelo de pie": ("Piernas", []),
    "Plancha (abdomen)": ("Core", []),
    "Swings con kettlebell": ("Piernas", ["Cardio / Otros"]),
}
