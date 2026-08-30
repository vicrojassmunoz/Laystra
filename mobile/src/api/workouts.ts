import { API_BASE_URL } from "../config";
import { Workout, WorkoutCreate } from "../types/workout";
import { buildErrorMessage } from "./http";

export async function fetchWorkouts(): Promise<Workout[]> {
  const response = await fetch(`${API_BASE_URL}/workouts`);

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}

export async function createWorkout(payload: WorkoutCreate): Promise<Workout> {
  const response = await fetch(`${API_BASE_URL}/workouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}

export async function updateWorkout(id: number, payload: WorkoutCreate): Promise<Workout> {
  const response = await fetch(`${API_BASE_URL}/workouts/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}

export async function deleteWorkout(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/workouts/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  // 204 No Content: no hay body que parsear.
}

export async function exportWorkoutsCsv(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/workouts/export`);

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.text();
}
