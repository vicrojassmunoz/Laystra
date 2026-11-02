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
