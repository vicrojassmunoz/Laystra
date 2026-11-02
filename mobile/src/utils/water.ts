// Por encima de esta cantidad en una sola entrada se pide confirmación
// (suele ser un typo: 1500 en vez de 150, o un recipiente mal ajustado).
export const LARGE_WATER_ENTRY_ML = 1500;

export function formatMl(ml: number): string {
  if (ml >= 1000) {
    const liters = ml / 1000;
    return `${Number.isInteger(liters) ? liters : liters.toFixed(2).replace(/0$/, "")} L`;
  }
  return `${ml} ml`;
}

// Fracciones rápidas de la capacidad de un recipiente para el ajuste "más o
// menos" (p. ej. te bebiste media botella). Se redondean a múltiplos de 5 ml.
export const CONTAINER_FRACTIONS: { label: string; factor: number }[] = [
  { label: "¼", factor: 0.25 },
  { label: "½", factor: 0.5 },
  { label: "¾", factor: 0.75 },
  { label: "1", factor: 1 },
];

export function fractionOf(capacityMl: number, factor: number): number {
  return Math.max(5, Math.round((capacityMl * factor) / 5) * 5);
}
