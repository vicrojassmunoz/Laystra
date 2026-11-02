import { formatSetLine } from "../components/WeightUnitChips";
import { Exercise } from "../types/exercise";
import { WorkoutSet } from "../types/workout";

export type ExerciseSummary = {
  exerciseId: number;
  name: string;
  // Una entrada por serie, ya formateada ("60kg x 8").
  entries: string[];
};

// Resumen por ejercicio de un workout: cada ejercicio aparece UNA vez, en el
// orden de su primera serie, con todas sus series -- también las de super-series
// (A, B, A, B), que agrupadas solo por tramos contiguos saldrían repetidas.
export function summarizeByExercise(
  sets: WorkoutSet[],
  exerciseById: Map<number, Exercise>
): ExerciseSummary[] {
  const byId = new Map<number, ExerciseSummary>();

  for (const set of sets) {
    const exercise = exerciseById.get(set.exercise_id);
    const unit = set.unit ?? exercise?.unit ?? "kg";
    const entry = formatSetLine(set.weight, unit, set.reps);

    const existing = byId.get(set.exercise_id);
    if (existing) {
      existing.entries.push(entry);
    } else {
      byId.set(set.exercise_id, {
        exerciseId: set.exercise_id,
        name: exercise?.name ?? `Ejercicio #${set.exercise_id}`,
        entries: [entry],
      });
    }
  }

  return Array.from(byId.values());
}
