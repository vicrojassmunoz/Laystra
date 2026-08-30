import { API_BASE_URL } from "../config";
import { Exercise, ExerciseCreate } from "../types/exercise";
import { buildErrorMessage } from "./http";

export async function fetchExercises(): Promise<Exercise[]> {
  const response = await fetch(`${API_BASE_URL}/exercises`);

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}

export async function createExercise(payload: ExerciseCreate): Promise<Exercise> {
  const response = await fetch(`${API_BASE_URL}/exercises`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}
