import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { fetchHabits, fetchHabitsToday } from "../api/habits";
import { Habit } from "../types/habit";
import { isoOf } from "./date";

// Recordatorios de hábitos con notificaciones locales (sin push remoto).
// Identificadores estables "habit-<id>-<fecha>": reprogramar el mismo día
// reemplaza en vez de duplicar. No toca la notificación de inactividad de
// sesión (esa usa un id propio sin este prefijo).
const PREFIX = "habit-";
// iOS conserva como máximo 64 notificaciones locales pendientes por app (las
// demás se descartan). Con 3 días por hábito caben ~21 hábitos con recordatorio;
// la sincronización se repite al abrir la app y al volver a primer plano, así
// que la ventana se va rellenando sola.
const DAYS_AHEAD = 3;
const SUPPORTED = Platform.OS !== "web";

function bodyFor(habit: Habit): string {
  switch (habit.kind) {
    case "steps":
      return "¿Llegaste a tus pasos de hoy?";
    case "water":
      return "¿Has bebido suficiente agua hoy?";
    default:
      return `Pendiente hoy: ${habit.name}`;
  }
}

// Pide permiso de notificaciones. Llamar SOLO al guardar un hábito con
// recordatorio (primer recordatorio): así no se pregunta a quien no los usa.
export async function ensureReminderPermission(): Promise<boolean> {
  if (!SUPPORTED) return false;
  try {
    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      ({ status } = await Notifications.requestPermissionsAsync());
    }
    return status === "granted";
  } catch {
    return false;
  }
}

// Serializa las sincronizaciones (dos a la vez podrían cancelar y programar
// entrelazadas) y las agrupa: si ya hay una en cola sin empezar, se reutiliza
// en vez de encolar otra (doSync lee datos frescos al empezar).
let chain: Promise<void> = Promise.resolve();
let queued: Promise<void> | null = null;

export function syncHabitReminders(): Promise<void> {
  if (!SUPPORTED) return Promise.resolve();
  if (queued) return queued;
  const run = chain.then(() => {
    queued = null; // a partir de aquí una nueva petición encola otra pasada
    return doSync();
  });
  queued = run.catch(() => undefined);
  chain = queued;
  return queued;
}

async function cancelOwn(): Promise<void> {
  // Solo los propios (prefijo), también los de hábitos borrados/desactivados.
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => n.identifier.startsWith(PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier))
  );
}

async function doSync(): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== "granted") {
    await cancelOwn(); // permiso revocado: no deben quedar recordatorios
    return;
  }

  // Primero los datos: si el backend falla, se dejan los recordatorios
  // existentes intactos (mejor un recordatorio viejo que ninguno).
  const now = new Date();
  let habits: Habit[];
  let doneToday: Set<number>;
  try {
    const [h, today] = await Promise.all([fetchHabits(), fetchHabitsToday(isoOf(now))]);
    habits = h;
    doneToday = new Set(today.filter((t) => t.done).map((t) => t.habit.id));
  } catch {
    return;
  }

  await cancelOwn();

  for (const habit of habits) {
    if (!habit.active || !habit.reminder_time) continue;
    const [hh, mm] = habit.reminder_time.split(":").map(Number);

    for (let i = 0; i < DAYS_AHEAD; i++) {
      const when = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hh, mm, 0);
      if (when.getTime() <= now.getTime()) continue;
      // Hábito ya cumplido hoy: no suena el de hoy.
      if (i === 0 && doneToday.has(habit.id)) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: `${PREFIX}${habit.id}-${isoOf(when)}`,
        content: { title: "Laystra", body: bodyFor(habit) },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
      });
    }
  }
}
