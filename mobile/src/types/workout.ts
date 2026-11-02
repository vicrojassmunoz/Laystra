// superset_group: null = serie suelta; mismo entero = misma super-serie.
// El ámbito de comparación es solo dentro de este workout, no es un id global.
import { WeightUnit } from "./exercise";
export type WorkoutSetCreate = {
  exercise_id: number;
  weight: number;
  reps: number;
  order: number;
  unit?: WeightUnit | null;
  superset_group: number | null;
};

export type WorkoutSet = WorkoutSetCreate & {
  id: number;
  workout_id: number;
};

export type WorkoutCreate = {
  date: string;
  routine_id: number | null;
  // Sensaciones (texto libre). null/omitido = sin nota. Un PUT sin `notes` la borra.
  notes?: string | null;
  sets: WorkoutSetCreate[];
};

export type Workout = {
  id: number;
  date: string;
  routine_id: number | null;
  notes?: string | null;
  sets: WorkoutSet[];
};
