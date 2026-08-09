from app.schemas.exercise import Exercise
from app.schemas.routine import Routine, RoutineExercise
from app.schemas.workout import Workout


class InMemoryStore:
    """Fase 0 stand-in for persistence — resets on restart. SQLite lands in Fase 1."""

    def __init__(self) -> None:
        self.exercises: dict[int, Exercise] = {}
        self.routines: dict[int, Routine] = {}
        self.schedule: dict[int, int | None] = {day: None for day in range(7)}
        self.workouts: dict[int, Workout] = {}

        self._next_exercise_id = 1
        self._next_routine_id = 1
        self._next_routine_exercise_id = 1
        self._next_workout_id = 1
        self._next_workout_set_id = 1

        self._seed()

    def next_exercise_id(self) -> int:
        value = self._next_exercise_id
        self._next_exercise_id += 1
        return value

    def next_routine_id(self) -> int:
        value = self._next_routine_id
        self._next_routine_id += 1
        return value

    def next_routine_exercise_id(self) -> int:
        value = self._next_routine_exercise_id
        self._next_routine_exercise_id += 1
        return value

    def next_workout_id(self) -> int:
        value = self._next_workout_id
        self._next_workout_id += 1
        return value

    def next_workout_set_id(self) -> int:
        value = self._next_workout_set_id
        self._next_workout_set_id += 1
        return value

    def _seed(self) -> None:
        bench = Exercise(id=self.next_exercise_id(), name="Press banca", unit="kg")
        squat = Exercise(id=self.next_exercise_id(), name="Sentadilla", unit="kg")
        deadlift = Exercise(id=self.next_exercise_id(), name="Peso muerto", unit="kg")
        pullup = Exercise(id=self.next_exercise_id(), name="Dominadas", unit="kg")
        row = Exercise(id=self.next_exercise_id(), name="Remo con barra", unit="kg")
        for exercise in (bench, squat, deadlift, pullup, row):
            self.exercises[exercise.id] = exercise

        push_id = self.next_routine_id()
        push_exercises = [
            RoutineExercise(
                id=self.next_routine_exercise_id(),
                routine_id=push_id,
                exercise_id=bench.id,
                target_sets=4,
                target_reps=8,
                order=0,
            ),
            RoutineExercise(
                id=self.next_routine_exercise_id(),
                routine_id=push_id,
                exercise_id=row.id,
                target_sets=3,
                target_reps=10,
                order=1,
            ),
        ]
        self.routines[push_id] = Routine(id=push_id, name="Push day", exercises=push_exercises)

        leg_id = self.next_routine_id()
        leg_exercises = [
            RoutineExercise(
                id=self.next_routine_exercise_id(),
                routine_id=leg_id,
                exercise_id=squat.id,
                target_sets=4,
                target_reps=6,
                order=0,
            ),
            RoutineExercise(
                id=self.next_routine_exercise_id(),
                routine_id=leg_id,
                exercise_id=deadlift.id,
                target_sets=3,
                target_reps=5,
                order=1,
            ),
            RoutineExercise(
                id=self.next_routine_exercise_id(),
                routine_id=leg_id,
                exercise_id=pullup.id,
                target_sets=3,
                target_reps=8,
                order=2,
            ),
        ]
        self.routines[leg_id] = Routine(id=leg_id, name="Pierna", exercises=leg_exercises)

        self.schedule[0] = push_id  # lunes
        self.schedule[2] = leg_id  # miércoles


store = InMemoryStore()
