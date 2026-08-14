// superset_group: null = ejercicio suelto; mismo entero = mismo bloque de
// super-serie. El ámbito de comparación es solo dentro de esta rutina, no es
// un id global (dos rutinas distintas pueden reusar el mismo número).
export type RoutineExercise = {
  id: number;
  routine_id: number;
  exercise_id: number;
  target_sets: number;
  order: number;
  superset_group: number | null;
};

export type RoutineExerciseCreate = {
  exercise_id: number;
  target_sets: number;
  order: number;
  superset_group: number | null;
};

export type Routine = {
  id: number;
  name: string;
  exercises: RoutineExercise[];
};

export type RoutineCreate = {
  name: string;
  exercises: RoutineExerciseCreate[];
};
