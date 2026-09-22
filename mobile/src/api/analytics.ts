import { API_BASE_URL } from "../config";
import { AnalyticsSummary } from "../types/analytics";
import { buildErrorMessage } from "./http";

export async function fetchAnalyticsSummary(): Promise<AnalyticsSummary> {
  const response = await fetch(`${API_BASE_URL}/analytics/summary`);

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}
