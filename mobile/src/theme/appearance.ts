import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";
import { Appearance } from "react-native";

// Preferencia de apariencia: seguir al sistema, o forzar claro / oscuro.
// Se guarda en el dispositivo (AsyncStorage) y se aplica con
// Appearance.setColorScheme, que hace que TODO (colores del tema, cabecera
// nativa, teclado, alertas) cambie a la vez.
export type AppearancePreference = "system" | "light" | "dark";

const KEY = "laystra.appearance";

export function applyAppearance(pref: AppearancePreference): void {
  try {
    Appearance.setColorScheme(pref === "system" ? "unspecified" : pref);
  } catch {
    // Web u otro entorno sin soporte: se queda con el esquema del sistema.
  }
}

// Llamar una vez al arrancar la app: restaura la preferencia guardada.
export async function restoreAppearance(): Promise<AppearancePreference> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      applyAppearance(stored);
      return stored;
    }
  } catch {
    // Sin almacenamiento: seguimos con "system".
  }
  return "system";
}

export function useAppearancePreference(): [AppearancePreference, (pref: AppearancePreference) => void] {
  const [pref, setPref] = useState<AppearancePreference>("system");

  useEffect(() => {
    let cancelled = false;
    void restoreAppearance().then((stored) => {
      if (!cancelled) {
        setPref(stored);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((next: AppearancePreference) => {
    setPref(next);
    applyAppearance(next);
    void AsyncStorage.setItem(KEY, next).catch(() => {});
  }, []);

  return [pref, update];
}
