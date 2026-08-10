// Construye el mensaje de error para una respuesta de fetch no-ok, intentando
// leer el campo "detail" que FastAPI incluye en sus errores (p.ej. HTTPException).
export async function buildErrorMessage(response: Response): Promise<string> {
  let detail: string | undefined;
  try {
    const body = await response.json();
    if (body && typeof body.detail === "string") {
      detail = body.detail;
    }
  } catch {
    // El cuerpo no era JSON o estaba vacío: seguimos con el mensaje genérico.
  }

  return detail
    ? `El backend respondió ${response.status}: ${detail}`
    : `El backend respondió ${response.status}`;
}
