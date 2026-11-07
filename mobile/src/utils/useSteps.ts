import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking } from "react-native";

import { fetchSteps } from "../api/steps";
import { syncHabitReminders } from "./habitReminders";
import { todayIsoDate } from "./date";
import {
  StepsPermission,
  getStepsPermission,
  requestStepsPermission,
  syncStepsFromPedometer,
} from "./steps";

// Sincroniza pasos al montar y al volver a primer plano; expone los de hoy y el
// estado del permiso. Los pasos de hoy salen del backend (máximo del día), así
// reabrir nunca los reduce.
export function useSteps() {
  const [permission, setPermission] = useState<StepsPermission | "checking">("checking");
  const [today, setToday] = useState<number | null>(null);
  const askedRef = useRef(false);
  const runningRef = useRef(false);

  const refresh = useCallback(async (perm: StepsPermission) => {
    let local: number | null = null;
    if (perm === "granted") {
      local = await syncStepsFromPedometer();
      // Los pasos recién subidos pueden cumplir la meta: reprograma recordatorios.
      void syncHabitReminders();
    }
    try {
      const days = await fetchSteps(todayIsoDate(), 1);
      const synced = days[0]?.steps ?? 0;
      // El podómetro es la fuente de verdad del iPhone: si hay lectura local y es
      // >= lo sincronizado, se muestra esa (es la más reciente). Si es menor, el
      // backend conserva un máximo anterior (p. ej. de una lectura previa) y se
      // muestra ese para no dar un valor que baje respecto al registrado.
      setToday(local !== null && local >= synced ? local : synced);
    } catch {
      // Backend no disponible: respaldo con el valor local del podómetro (sin
      // mezclarlo con valores previos, que podrían ser erróneos); si no lo hay,
      // se conserva el último valor.
      if (local !== null) setToday(local);
    }
  }, []);

  const run = useCallback(
    async (allowPrompt: boolean) => {
      // Montaje y AppState "active" pueden coincidir: una sola sincronización a la vez.
      if (runningRef.current) {
        return;
      }
      runningRef.current = true;
      try {
        let perm = await getStepsPermission();
        if (perm === "undetermined" && allowPrompt && !askedRef.current) {
          askedRef.current = true;
          perm = await requestStepsPermission();
        }
        setPermission(perm);
        await refresh(perm);
      } finally {
        runningRef.current = false;
      }
    },
    [refresh]
  );

  useEffect(() => {
    run(true);
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") run(false);
    });
    return () => sub.remove();
  }, [run]);

  // Botón "Activar pasos": pide permiso o, si ya estaba denegado, abre Ajustes.
  const activate = useCallback(async () => {
    // Denegado: iOS no vuelve a preguntar, así que se abre Ajustes de la app.
    if ((await getStepsPermission()) === "denied") {
      try {
        await Linking.openSettings();
      } catch {
        // Sin Ajustes disponibles (web): nada que hacer.
      }
      return;
    }
    const perm = await requestStepsPermission();
    setPermission(perm);
    await refresh(perm);
  }, [refresh]);

  return { permission, today, activate };
}
