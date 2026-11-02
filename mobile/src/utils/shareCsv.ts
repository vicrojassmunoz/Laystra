import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";

// Escribe `csv` (con BOM para que Excel lo abra en UTF-8) en la caché y abre la
// hoja de compartir. Misma mecánica que el export de Historial (File/Paths es la
// API de expo-file-system del SDK 57; writeAsStringAsync del import principal
// está deprecado).
export async function shareCsv(csv: string, fileName: string, dialogTitle: string): Promise<void> {
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Compartir no está disponible en este dispositivo.");
  }
  const withBom = csv.startsWith("﻿") ? csv : `﻿${csv}`;
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(withBom);
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    UTI: "public.comma-separated-values-text",
    dialogTitle,
  });
}
