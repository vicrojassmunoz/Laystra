import { API_BASE_URL } from "../config";
import { Exercise } from "../types/exercise";
import { buildErrorMessage } from "./http";

export async function fetchExercises(): Promise<Exercise[]> {
  const response = await fetch(`${API_BASE_URL}/exercises`);

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}
