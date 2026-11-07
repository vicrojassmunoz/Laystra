import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

// Duración por defecto del descanso entre series (global, en segundos). Se guarda
// en el dispositivo igual que theme/appearance.ts: AsyncStorage con try/catch
// ("best effort"). Se mantiene también en una variable de módulo para que
// SessionContext pueda leerla de forma síncrona al completar una serie.
export const REST_OPTIONS = [60, 90, 120, 180] as const;
export const DEFAULT_REST_SECONDS = 90;

const KEY = "laystra.restSeconds";

let cached = DEFAULT_REST_SECONDS;
// El usuario ya eligió un valor en esta ejecución: la lectura inicial (lenta) no lo pisa.
let chosenByUser = false;

export function getRestSeconds(): number {
  return cached;
}

function isValid(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n) && n >= 10 && n <= 60 * 60;
}

export async function loadRestSeconds(): Promise<number> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    const n = stored === null ? NaN : Number(stored);
    if (isValid(n) && !chosenByUser) {
      cached = n;
    }
  } catch {
    // Sin almacenamiento: se queda con el valor por defecto.
  }
  return cached;
}

export function formatRestLabel(seconds: number): string {
  if (seconds % 60 === 0) {
    return `${seconds / 60} min`;
  }
  return seconds > 60 ? `${Math.floor(seconds / 60)} min ${seconds % 60} s` : `${seconds} s`;
}

export function useRestSeconds(): [number, (seconds: number) => void] {
  const [seconds, setSeconds] = useState(cached);

  useEffect(() => {
    let cancelled = false;
    void loadRestSeconds().then((n) => {
      if (!cancelled) {
        setSeconds(n);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback((next: number) => {
    if (!isValid(next)) {
      return;
    }
    chosenByUser = true;
    cached = next;
    setSeconds(next);
    void AsyncStorage.setItem(KEY, String(next)).catch(() => {});
  }, []);

  return [seconds, update];
}
