import { API_BASE_URL } from "../config";
import {
  WaterContainer,
  WaterContainerCreate,
  WaterDay,
  WaterDayTotal,
  WaterEntry,
  WaterEntryCreate,
} from "../types/water";
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

export function fetchWaterDay(date: string): Promise<WaterDay> {
  return request(`/water?date=${date}`);
}

export function fetchWaterHistory(end: string, days: number): Promise<WaterDayTotal[]> {
  return request(`/water/history?end=${end}&days=${days}`);
}

export function createWaterEntry(payload: WaterEntryCreate): Promise<WaterEntry> {
  return request("/water/entries", jsonInit("POST", payload));
}

export function deleteWaterEntry(id: number): Promise<void> {
  return request(`/water/entries/${id}`, { method: "DELETE" });
}

export function fetchWaterContainers(): Promise<WaterContainer[]> {
  return request("/water/containers");
}

export function createWaterContainer(payload: WaterContainerCreate): Promise<WaterContainer> {
  return request("/water/containers", jsonInit("POST", payload));
}

export function updateWaterContainer(
  id: number,
  payload: WaterContainerCreate
): Promise<WaterContainer> {
  return request(`/water/containers/${id}`, jsonInit("PUT", payload));
}

export function deleteWaterContainer(id: number): Promise<void> {
  return request(`/water/containers/${id}`, { method: "DELETE" });
}

export function updateWaterGoal(goalMl: number): Promise<{ goal_ml: number }> {
  return request("/water/settings", jsonInit("PUT", { goal_ml: goalMl }));
}

export async function exportWaterCsv(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/water/export`);

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.text();
}
