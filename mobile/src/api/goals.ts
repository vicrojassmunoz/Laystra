import { API_BASE_URL } from "../config";
import { Goal, GoalCreate, GoalUpdate } from "../types/goal";
import { buildErrorMessage } from "./http";

export async function fetchGoals(): Promise<Goal[]> {
  const response = await fetch(`${API_BASE_URL}/goals`);

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}

export async function createGoal(payload: GoalCreate): Promise<Goal> {
  const response = await fetch(`${API_BASE_URL}/goals`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}

export async function updateGoal(id: number, payload: GoalUpdate): Promise<Goal> {
  const response = await fetch(`${API_BASE_URL}/goals/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}

export async function deleteGoal(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/goals/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  // 204 No Content: no hay body que parsear.
}
