export type ProgressPoint = {
  date: string;
  workout_id: number;
  best_weight: number;
  total_reps: number;
  unit?: string | null;
  // Mejor serie del día por peso×reps, en kg. Opcional por la ventana de deploy
  // (un backend viejo no lo manda).
  best_set_volume_kg?: number;
};

export type ProgressResponse = {
  exercise_id: number;
  exercise_name: string;
  points: ProgressPoint[];
};
