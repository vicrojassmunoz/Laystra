import { API_BASE_URL } from "../config";
import { Exercise } from "../types/exercise";
import { buildErrorMessage } from "./http";

// superset_group: null = ejercicio suelto; mismo entero = mismo bloque de
// super-serie, con ámbito solo dentro de este /today (no es un id global).
export type TodayExercise = {
  exercise_id: number;
  exercise_name: string;
  unit: Exercise["unit"];
  target_sets: number;
  order: number;
  superset_group: number | null;
};

export type TodayResponse = {
  date: string;
  day_of_week: number;
  routine_id: number | null;
  routine_name: string | null;
  exercises: TodayExercise[];
};

export function todayIsoDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function fetchToday(): Promise<TodayResponse> {
  const response = await fetch(`${API_BASE_URL}/today?date=${todayIsoDate()}`);

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}
