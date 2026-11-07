// Texto corto de una duración en segundos: "52 min", "1 h 05 min".
// null/undefined (entrenos antiguos o sin cronómetro) -> null: no se muestra nada.
export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds < 0) {
    return null;
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 1) {
    return "< 1 min";
  }
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h} h ${String(m).padStart(2, "0")} min`;
}
