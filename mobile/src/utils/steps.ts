import { Pedometer } from "expo-sensors";

import { putSteps } from "../api/steps";
import { HabitProgress } from "../types/habit";
import { isoOf } from "./date";

// Meta por defecto; la real es el `target` del hábito `steps` (ver stepsGoalFrom).
export const STEPS_GOAL = 8000;

export function stepsGoalFrom(items: HabitProgress[] | null): number {
  const steps = items?.find((i) => i.habit.kind === "steps");
  return steps?.target ?? steps?.habit.target ?? STEPS_GOAL;
}

// iOS solo guarda ~7 días de historial en el podómetro.
const SYNC_DAYS_BACK = 7;

export function formatSteps(n: number): string {
  return n.toLocaleString("es-ES");
}

export type StepsPermission = "granted" | "denied" | "undetermined" | "unavailable";

// Consulta el estado sin mostrar diálogos. "unavailable" = sin sensor (web, simulador).
export async function getStepsPermission(): Promise<StepsPermission> {
  try {
    if (!(await Pedometer.isAvailableAsync())) return "unavailable";
    const { status } = await Pedometer.getPermissionsAsync();
    return status === "granted" ? "granted" : status === "denied" ? "denied" : "undetermined";
  } catch {
    return "unavailable";
  }
}

export async function requestStepsPermission(): Promise<StepsPermission> {
  try {
    if (!(await Pedometer.isAvailableAsync())) return "unavailable";
    const { status } = await Pedometer.requestPermissionsAsync();
    return status === "granted" ? "granted" : "denied";
  } catch {
    return "unavailable";
  }
}

// Lee el podómetro día a día (00:00-24:00 locales, hoy hasta ahora) para hoy y
// hasta 7 días atrás, y sube cada día con >0 pasos. Un día sin datos del sensor
// no corta el resto, pero el primer fallo de red SÍ corta (backend caído: no
// encadenar 8 peticiones colgadas). Devuelve los pasos locales de hoy (null si
// el sensor no dio dato) para usarlos de respaldo si el backend falla.
export async function syncStepsFromPedometer(): Promise<number | null> {
  const now = new Date();
  let todayLocal: number | null = null;

  for (let back = 0; back <= SYNC_DAYS_BACK; back++) {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
    const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back + 1);
    const end = back === 0 ? now : nextMidnight;
    let steps: number;
    try {
      ({ steps } = await Pedometer.getStepCountAsync(start, end));
    } catch {
      continue; // Sin datos del sensor para ese día.
    }
    const rounded = Math.min(Math.round(steps), 500000);
    if (back === 0) todayLocal = rounded;
    if (rounded <= 0) continue;
    try {
      await putSteps(isoOf(start), rounded);
    } catch {
      break; // Backend no disponible: se reintenta en la próxima sincronización.
    }
  }
  return todayLocal;
}
