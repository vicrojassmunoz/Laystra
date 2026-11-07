import { API_BASE_URL } from "../config";
import { StepsDay } from "../types/steps";
import { buildErrorMessage } from "./http";

// Upsert por día: el backend conserva el máximo, así que mandar menos no reduce.
export async function putSteps(date: string, steps: number): Promise<StepsDay> {
  const response = await fetch(`${API_BASE_URL}/steps/${date}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ steps }),
  });
  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }
  return response.json();
}

// Más reciente primero; incluye días sin registro con 0. `end` = fecha local del móvil.
export async function fetchSteps(end: string, days = 7): Promise<StepsDay[]> {
  const response = await fetch(`${API_BASE_URL}/steps?days=${days}&end=${end}`);
  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }
  return response.json();
}
