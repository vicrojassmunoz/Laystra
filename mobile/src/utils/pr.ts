import { parseDecimalInput } from "./number";
import { toKg } from "./weightUnit";

// Mejores marcas históricas de un ejercicio, precargadas desde /progress.
// `weight`/`unit` = mejor peso (en su unidad original). `volumeKg` = mejor
// serie por peso×reps normalizada a kg; null si el backend no lo manda (versión
// vieja durante un deploy) -- en ese caso no se pinta PR de volumen.
export type BestMark = {
  weight: number;
  unit: string;
  volumeKg: number | null;
};

export type PrFlags = {
  weight: boolean;
  volume: boolean;
};

// PR de peso: supera el mejor peso histórico (criterio original, no mira reps).
// PR de volumen: peso×reps de esta serie supera la mejor serie histórica por
// volumen. Necesita reps > 0 -- sin reps escritas no hay volumen que comparar.
export function prFlags(
  typedWeight: number | null,
  unit: string,
  reps: number | null,
  best: BestMark | undefined
): PrFlags {
  if (typedWeight === null || best === undefined) {
    return { weight: false, volume: false };
  }

  const weightKg = toKg(typedWeight, unit);
  const volumeKg = reps !== null && reps > 0 ? weightKg * reps : 0;

  return {
    weight: weightKg > toKg(best.weight, best.unit),
    volume: best.volumeKg !== null && best.volumeKg > 0 && volumeKg > best.volumeKg,
  };
}

// Reps de un campo de texto: entero >= 0, o null si está vacío/inválido.
export function parseReps(text: string): number | null {
  if (text.trim() === "") {
    return null;
  }
  const value = Number(text);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

export const NO_PR: PrFlags = { weight: false, volume: false };

type PrRow = {
  exerciseId: number;
  unit: string;
  sets: { id: number; weight: string; reps: string }[];
};

// Decide qué series del formulario actual llevan badge de PR, comparando contra
// el histórico (`prFlags`) Y entre sí: si en la misma sesión haces 50 kg y luego
// 49 kg con un récord previo de 45, ambas superan el histórico pero solo la de
// 50 es PR. Por ejercicio (agregando todas sus filas del formulario) y por
// separado para peso y volumen, solo se marca la mejor serie; en empate gana la
// primera. Devuelve set.id -> flags (los ids de SetDraft son únicos en Hoy).
export function computePrFlags(
  rows: PrRow[],
  bestMarks: Map<number, BestMark>,
  bodyWeightKg: number | null
): Map<number, PrFlags> {
  type Candidate = { id: number; flags: PrFlags; weightKg: number; volumeKg: number };
  const byExercise = new Map<number, Candidate[]>();

  for (const row of rows) {
    for (const set of row.sets) {
      const typed = row.unit === "bw" ? bodyWeightKg : parseDecimalInput(set.weight);
      const reps = parseReps(set.reps);
      const flags = prFlags(typed, row.unit, reps, bestMarks.get(row.exerciseId));
      const weightKg = typed === null ? 0 : toKg(typed, row.unit);
      const volumeKg = reps !== null && reps > 0 ? weightKg * reps : 0;
      const list = byExercise.get(row.exerciseId) ?? [];
      list.push({ id: set.id, flags, weightKg, volumeKg });
      byExercise.set(row.exerciseId, list);
    }
  }

  const result = new Map<number, PrFlags>();
  for (const candidates of byExercise.values()) {
    let weightWinner: Candidate | null = null;
    let volumeWinner: Candidate | null = null;
    for (const c of candidates) {
      // `>` estricto: en empate se queda la primera serie.
      if (c.flags.weight && (weightWinner === null || c.weightKg > weightWinner.weightKg)) {
        weightWinner = c;
      }
      if (c.flags.volume && (volumeWinner === null || c.volumeKg > volumeWinner.volumeKg)) {
        volumeWinner = c;
      }
    }
    for (const c of candidates) {
      result.set(c.id, { weight: c === weightWinner, volume: c === volumeWinner });
    }
  }
  return result;
}
