import { API_BASE_URL } from "../config";
import { BodyMetric, BodyMetricCreate } from "../types/bodyMetric";
import { buildErrorMessage } from "./http";

export async function fetchBodyMetrics(): Promise<BodyMetric[]> {
  const response = await fetch(`${API_BASE_URL}/body-metrics`);

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}

export async function createBodyMetric(payload: BodyMetricCreate): Promise<BodyMetric> {
  const response = await fetch(`${API_BASE_URL}/body-metrics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}

export async function deleteBodyMetric(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/body-metrics/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  // 204 No Content: no hay body que parsear.
}
