import { API_BASE_URL } from "../config";
import { Routine, RoutineCreate } from "../types/routine";
import { buildErrorMessage } from "./http";

export async function fetchRoutines(): Promise<Routine[]> {
  const response = await fetch(`${API_BASE_URL}/routines`);

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}

export async function createRoutine(payload: RoutineCreate): Promise<Routine> {
  const response = await fetch(`${API_BASE_URL}/routines`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}

export async function updateRoutine(id: number, payload: RoutineCreate): Promise<Routine> {
  const response = await fetch(`${API_BASE_URL}/routines/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}

export async function deleteRoutine(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/routines/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  // 204 No Content: no hay body que parsear.
}
