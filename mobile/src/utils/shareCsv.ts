import { Platform } from "react-native";

// Entrega un CSV al usuario (con BOM para que Excel lo abra en UTF-8).
// - iOS/Android: lo escribe en la caché y abre la hoja de compartir. File/Paths
//   es la API de expo-file-system del SDK 58 (writeAsStringAsync del import
//   principal está deprecado). Los módulos nativos se importan aquí dentro, no
//   arriba, para que la versión web no cargue código que no existe en el navegador.
// - Web (vista previa en navegador): descarga el fichero.
export async function shareCsv(csv: string, fileName: string, dialogTitle: string): Promise<void> {
  const withBom = csv.startsWith("﻿") ? csv : `﻿${csv}`;

  if (Platform.OS === "web") {
    const blob = new Blob([withBom], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  const [{ File, Paths }, Sharing] = await Promise.all([
    import("expo-file-system"),
    import("expo-sharing"),
  ]);

  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error("Compartir no está disponible en este dispositivo.");
  }
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  file.write(withBom);
  await Sharing.shareAsync(file.uri, {
    mimeType: "text/csv",
    UTI: "public.comma-separated-values-text",
    dialogTitle,
  });
}
