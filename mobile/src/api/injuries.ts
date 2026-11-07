import { API_BASE_URL } from "../config";
import { Injury, InjuryInput } from "../types/injury";
import { buildErrorMessage } from "./http";

// active: true -> solo las activas (lo que usan los avisos); sin parámetro -> todas.
export async function fetchInjuries(active?: boolean): Promise<Injury[]> {
  const query = active === undefined ? "" : `?active=${active}`;
  const response = await fetch(`${API_BASE_URL}/injuries${query}`);
  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }
  return response.json();
}

export async function createInjury(payload: InjuryInput): Promise<Injury> {
  const response = await fetch(`${API_BASE_URL}/injuries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }
  return response.json();
}

// PUT es reemplazo total: hay que mandar todos los campos, no solo el cambiado
// (p. ej. para activar/desactivar se reenvía la lesión entera con `active` nuevo).
export async function updateInjury(id: number, payload: InjuryInput): Promise<Injury> {
  const response = await fetch(`${API_BASE_URL}/injuries/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }
  return response.json();
}

export async function deleteInjury(id: number): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/injuries/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(await buildErrorMessage(response));
  }
}
