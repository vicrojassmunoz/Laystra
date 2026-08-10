export type RoutineExercise = {
  id: number;
  routine_id: number;
  exercise_id: number;
  target_sets: number;
  order: number;
};

export type RoutineExerciseCreate = {
  exercise_id: number;
  target_sets: number;
  order: number;
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
