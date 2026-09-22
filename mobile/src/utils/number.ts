// El teclado decimal-pad en un iPhone con locale español muestra coma, no
// punto, así que "82,5" tiene que normalizarse antes de Number(...).
// Devuelve null si el texto está vacío, no es un número válido, o es
// negativo -- mismo criterio de validación que ya usaban TodayScreen y
// HistorialScreen antes de que esta función se extrajera para evitar
// duplicar la misma lógica en cada pantalla que pide un peso.
export function parseDecimalInput(text: string): number | null {
  const raw = text.trim().replace(",", ".");
  if (raw === "") {
    return null;
  }

  const value = Number(raw);
  // !Number.isFinite cubre tanto NaN (texto no numérico) como Infinity/-Infinity
  // -- Number("Infinity") es un número JS válido, así que Number.isNaN solo no
  // bastaba para rechazarlo.
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}
