// Mismo factor que backend/app/units.py — catálogo duplicado a mano
// (ver .cursor/rules/api-contract.mdc).
const LB_TO_KG = 0.45359237;

export function formatWeightUnit(unit: string): string {
  return unit === "bw" ? "PC" : unit;
}

export function toKg(weight: number, unit: string): number {
  return unit === "lb" ? weight * LB_TO_KG : weight;
}

export function convertWeight(weight: number, fromUnit: string, toUnit: string): number {
  if (fromUnit === toUnit) {
    return weight;
  }
  const weightKg = toKg(weight, fromUnit);
  return toUnit === "lb" ? weightKg / LB_TO_KG : weightKg;
}
