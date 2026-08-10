import { API_BASE_URL } from "../config";
import { ScheduleEntry } from "../types/schedule";
import { buildErrorMessage } from "./http";

export async function fetchSchedule(): Promise<ScheduleEntry[]> {
  const response = await fetch(`${API_BASE_URL}/schedule`);

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}

export async function updateScheduleDay(
  day: number,
  routineId: number | null
): Promise<ScheduleEntry> {
  const response = await fetch(`${API_BASE_URL}/schedule/${day}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ routine_id: routineId }),
  });

  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }

  return response.json();
}
