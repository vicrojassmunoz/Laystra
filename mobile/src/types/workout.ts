export type WorkoutSetCreate = {
  exercise_id: number;
  weight: number;
  reps: number;
  order: number;
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
