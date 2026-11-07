import { Goal } from "../types/goal";

// Días enteros desde hoy (local) hasta la fecha ISO; negativo = ya pasó.
export function daysUntil(iso: string, todayIso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const [ty, tm, td] = todayIso.split("-").map(Number);
  return Math.round(
    (new Date(y, m - 1, d).getTime() - new Date(ty, tm - 1, td).getTime()) / 86400000
  );
}

export function countdownLabel(days: number): string {
  if (days === 0) return "es hoy";
  if (days === 1) return "falta 1 día";
  if (days > 1) return `faltan ${days} días`;
  if (days === -1) return "pasó hace 1 día";
  return `pasó hace ${-days} días`;
}

// Evento pendiente con fecha más cercano (hoy o futuro). null si no hay.
export function nextEvent(goals: Goal[], todayIso: string): Goal | null {
  const upcoming = goals
    .filter((g) => !g.done && g.target_date !== null && g.target_date >= todayIso)
    .sort((a, b) => (a.target_date as string).localeCompare(b.target_date as string));
  return upcoming[0] ?? null;
}
