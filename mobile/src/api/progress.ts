import { API_BASE_URL } from "../config";
import { ProgressResponse } from "../types/progress";
import { buildErrorMessage } from "./http";

export async function fetchProgress(exerciseId: number): Promise<ProgressResponse> {
  const response = await fetch(`${API_BASE_URL}/exercises/${exerciseId}/progress`);

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}
