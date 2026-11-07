import { useEffect } from "react";
import { AppState } from "react-native";

import { syncHabitReminders } from "./habitReminders";

// Reprograma los recordatorios al abrir la app y al volver a primer plano.
export function useHabitReminders() {
  useEffect(() => {
    void syncHabitReminders();
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") void syncHabitReminders();
    });
    return () => sub.remove();
  }, []);
}
