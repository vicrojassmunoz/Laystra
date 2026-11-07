import { API_BASE_URL } from "../config";
import { Habit, HabitPayload, HabitProgress } from "../types/habit";
import { buildErrorMessage } from "./http";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, init);
  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }
  // 204 No Content (DELETE): no hay body que parsear.
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json();
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

// Todos los hábitos, activos e inactivos.
export function fetchHabits(): Promise<Habit[]> {
  return request("/habits");
}

// Solo activos, con progreso del día (water/steps derivados en el backend).
export function fetchHabitsToday(date: string): Promise<HabitProgress[]> {
  return request(`/habits/today?date=${date}`);
}

export function createHabit(payload: HabitPayload): Promise<Habit> {
  return request("/habits", jsonInit("POST", payload));
}

export function updateHabit(id: number, payload: HabitPayload): Promise<Habit> {
  return request(`/habits/${id}`, jsonInit("PUT", payload));
}

export function deleteHabit(id: number): Promise<void> {
  return request(`/habits/${id}`, { method: "DELETE" });
}

// Solo check (0|1) y count (0..1e6).
export function logHabit(id: number, date: string, value: number): Promise<HabitProgress> {
  return request(`/habits/${id}/log`, jsonInit("PUT", { date, value }));
}
