// superset_group: null = serie suelta; mismo entero = misma super-serie.
// El ámbito de comparación es solo dentro de este workout, no es un id global.
export type WorkoutSetCreate = {
  exercise_id: number;
  weight: number;
  reps: number;
  order: number;
  superset_group: number | null;
};

export type WorkoutSet = WorkoutSetCreate & {
  id: number;
  workout_id: number;
};

export type WorkoutCreate = {
  date: string;
  routine_id: number | null;
  sets: WorkoutSetCreate[];
};

export type Workout = {
  id: number;
  date: string;
  routine_id: number | null;
  sets: WorkoutSet[];
};
