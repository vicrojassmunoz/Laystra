import { formatSetLine } from "../components/WeightUnitChips";
import { Exercise } from "../types/exercise";
import { Workout, WorkoutSet } from "../types/workout";
import { formatWeightUnit, toKg } from "./weightUnit";

export type ExerciseSummary = {
  exerciseId: number;
  name: string;
  // Una entrada por serie, ya formateada ("60kg x 8").
  entries: string[];
  // Línea lista para mostrar: si todas las series pesan lo mismo, el peso una
  // sola vez y las reps en lista ("70 kg × 6, 5, 5"); si no, las series una a una.
  line: string;
};

type Raw = { weight: number; unit: string; reps: number };

function weightLabel(weight: number, unit: string): string {
  if (unit === "bw") {
    return weight > 0 ? `PC ${weight} kg` : "PC";
  }
  return `${weight} ${formatWeightUnit(unit)}`;
}

function buildLine(raw: Raw[], entries: string[]): string {
  const first = raw[0];
  const same = raw.every((r) => r.weight === first.weight && r.unit === first.unit);
  if (same && raw.length > 1) {
    return `${weightLabel(first.weight, first.unit)} × ${raw.map((r) => r.reps).join(", ")}`;
  }
  return entries.join("   ");
}

// Resumen por ejercicio de un workout: cada ejercicio aparece UNA vez, en el
// orden de su primera serie, con todas sus series -- también las de super-series
// (A, B, A, B), que agrupadas solo por tramos contiguos saldrían repetidas.
export function summarizeByExercise(
  sets: WorkoutSet[],
  exerciseById: Map<number, Exercise>
): ExerciseSummary[] {
  const byId = new Map<number, { summary: ExerciseSummary; raw: Raw[] }>();

  for (const set of sets) {
    const exercise = exerciseById.get(set.exercise_id);
    const unit = set.unit ?? exercise?.unit ?? "kg";
    const entry = formatSetLine(set.weight, unit, set.reps);

    const existing = byId.get(set.exercise_id);
    if (existing) {
      existing.summary.entries.push(entry);
      existing.raw.push({ weight: set.weight, unit, reps: set.reps });
    } else {
      byId.set(set.exercise_id, {
        summary: {
          exerciseId: set.exercise_id,
          name: exercise?.name ?? `Ejercicio #${set.exercise_id}`,
          entries: [entry],
          line: "",
        },
        raw: [{ weight: set.weight, unit, reps: set.reps }],
      });
    }
  }

  return Array.from(byId.values()).map(({ summary, raw }) => ({
    ...summary,
    line: buildLine(raw, summary.entries),
  }));
}

export function workoutStats(workout: Workout): { exercises: number; sets: number; volumeKg: number } {
  const exercises = new Set(workout.sets.map((s) => s.exercise_id)).size;
  const volumeKg = workout.sets.reduce(
    (sum, s) => sum + toKg(s.weight, s.unit ?? "kg") * s.reps,
    0
  );
  return { exercises, sets: workout.sets.length, volumeKg };
}

// "4,2 t" a partir de 1000 kg, "850 kg" por debajo.
export function formatVolume(kg: number): string {
  if (kg >= 1000) {
    return `${(kg / 1000).toFixed(1).replace(".", ",")} t`;
  }
  return `${Math.round(kg)} kg`;
}

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// "lun 7 sep"
export function dayLabel(iso: string): string {
  return parseIso(iso).toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).replace(/[.,]/g, "");
}

// "Septiembre 2026"
export function monthLabel(iso: string): string {
  return capitalize(parseIso(iso).toLocaleDateString("es-ES", { month: "long", year: "numeric" }));
}
