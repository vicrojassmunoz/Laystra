export type ProgressPoint = {
  date: string;
  workout_id: number;
  best_weight: number;
  total_reps: number;
};

export type ProgressResponse = {
  exercise_id: number;
  exercise_name: string;
  points: ProgressPoint[];
};
