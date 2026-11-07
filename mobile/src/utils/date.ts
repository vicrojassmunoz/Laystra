// Fecha ISO "AAAA-MM-DD" en hora LOCAL (no toISOString, que da UTC y puede
// caer en el día anterior/siguiente cerca de medianoche).
export function isoOf(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

export function todayIsoDate(): string {
  return isoOf(new Date());
}
