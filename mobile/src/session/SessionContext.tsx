import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
import {
  Dispatch,
  MutableRefObject,
  ReactNode,
  SetStateAction,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { TodayExercise, todayIsoDate } from "../api/today";
import { SetDraft } from "../components/SupersetBlock";
import { haptic } from "../motion/motion";
import { getRestSeconds, loadRestSeconds } from "../utils/restTimer";

// Tipos del formulario de la sesión (antes vivían dentro de TodayScreen).
export type ExerciseDraft = {
  exercise: TodayExercise;
  sets: SetDraft[];
};

// Qué rutina (o "entreno libre") representa el formulario ahora mismo.
export type FormTarget = {
  routineId: number | null;
  routineName: string | null; // null = entreno libre
  exercises: TodayExercise[];
};

// Resumen colapsado de un entreno ya guardado durante esta sesión.
export type SavedSummary = {
  workoutId: number;
  label: string;
};

type Snapshot = { formTarget: FormTarget; formRows: ExerciseDraft[]; notes: string };

// Borrador de sesión persistido en AsyncStorage (mismo patrón que
// theme/appearance.ts: try/catch, el almacenamiento es "best effort"). Así,
// si iOS mata la app a mitad de entreno, al reabrirla se recuperan cronómetro
// y series. Solo se guarda mientras hay sesión activa.
// IMPORTANTE: cualquier cambio en la forma de ExerciseDraft (o de lo que contiene:
// TodayExercise, SetDraft) obliga a subir esta clave a ".v2": un borrador viejo
// con otra forma se restauraría sin validar y podría romper la pantalla Sesión.
const DRAFT_KEY = "laystra.sessionDraft.v1";
// Un borrador más viejo que esto se descarta al restaurar (sesión olvidada).
const DRAFT_MAX_AGE_MS = 18 * 60 * 60 * 1000;
const PERSIST_DEBOUNCE_MS = 400;

type PersistedDraft = {
  savedAt: number;
  // null = sesión "preparada": existe el borrador pero el cronómetro aún no ha arrancado.
  startedAt: number | null;
  pausedAt: number | null;
  lastSetAt: number | null;
  segmentStart: number | null;
  draftKey: string | null;
  formTarget: FormTarget | null;
  formRows: ExerciseDraft[];
  notes: string;
  submitted: boolean;
  skipped: boolean;
  savedSummaries: SavedSummary[];
  snapshot: Snapshot | null;
  routineSaved: boolean;
  // ms epoch en que acaba la cuenta atrás de descanso; null = sin descanso activo.
  // Campo opcional añadido después: un borrador viejo sin él se lee como null, así
  // que no hace falta subir DRAFT_KEY.
  restEndAt: number | null;
};

// Día (YYYY-MM-DD, hora local) al que pertenece el borrador: el de su draftKey
// (que empieza por la fecha de /today) o, si no hay, el de su inicio.
function draftDay(d: PersistedDraft): string {
  const fromKey = d.draftKey?.split("|")[0];
  if (fromKey && /^\d{4}-\d{2}-\d{2}$/.test(fromKey)) {
    return fromKey;
  }
  const dt = new Date(d.startedAt ?? d.savedAt);
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${dt.getFullYear()}-${mm}-${dd}`;
}

function isNumOrNull(v: unknown): v is number | null {
  return v === null || typeof v === "number";
}

// Validación mínima del JSON leído: si algo no cuadra se ignora el borrador en
// vez de arriesgar un crash al restaurar.
function parseDraft(raw: string | null): PersistedDraft | null {
  if (raw === null) {
    return null;
  }
  try {
    const d = JSON.parse(raw) as Partial<PersistedDraft>;
    if (
      !isNumOrNull(d.segmentStart ?? null) ||
      !(d.draftKey === undefined || d.draftKey === null || typeof d.draftKey === "string") ||
      !isNumOrNull(d.startedAt ?? null) ||
      typeof d.savedAt !== "number" ||
      !isNumOrNull(d.pausedAt ?? null) ||
      !isNumOrNull(d.lastSetAt ?? null) ||
      !isNumOrNull(d.restEndAt ?? null) ||
      !Array.isArray(d.formRows) ||
      !Array.isArray(d.savedSummaries)
    ) {
      return null;
    }
    if (Date.now() - d.savedAt > DRAFT_MAX_AGE_MS) {
      return null;
    }
    return {
      savedAt: d.savedAt,
      startedAt: d.startedAt ?? null,
      pausedAt: d.pausedAt ?? null,
      lastSetAt: d.lastSetAt ?? null,
      segmentStart: d.segmentStart ?? null,
      draftKey: d.draftKey ?? null,
      formTarget: d.formTarget ?? null,
      formRows: d.formRows,
      notes: typeof d.notes === "string" ? d.notes : "",
      submitted: d.submitted === true,
      skipped: d.skipped === true,
      savedSummaries: d.savedSummaries,
      snapshot: d.snapshot ?? null,
      routineSaved: d.routineSaved === true,
      restEndAt: d.restEndAt ?? null,
    };
  } catch {
    return null;
  }
}

function maxSetId(rows: ExerciseDraft[]): number {
  let max = 0;
  for (const row of rows) {
    for (const s of row.sets) {
      max = Math.max(max, s.id);
    }
  }
  return max;
}

// "¿Sigues por aquí?": si pasa 1 h sin teclear nada nuevo en la sesión, llega
// una notificación local. Se programa en el sistema (no depende de que la app
// siga viva en primer plano) y se reprograma en cada actividad.
const INACTIVITY_SECONDS = 60 * 60;
// Texto legible del umbral ("1 h" / "30 min") para el cuerpo del aviso y los textos de Hoy.
export const INACTIVITY_LABEL =
  INACTIVITY_SECONDS >= 3600
    ? `${INACTIVITY_SECONDS / 3600} h`
    : `${Math.round(INACTIVITY_SECONDS / 60)} min`;
const INACTIVITY_BODY = `Ey, ¿sigues por aquí? Llevas ${INACTIVITY_LABEL} sin registrar nada en tu sesión.`;
// Teclear dispara muchos touch(): se agrupan para no reprogramar en cada tecla.
const RESCHEDULE_DEBOUNCE_MS = 2000;
// Identificador fijo: reprogramar con el mismo id sustituye la notificación en vez
// de duplicarla, y se puede cancelar siempre por id (sin cancelAll: los recordatorios
// de hábitos "habit-*" son notificaciones locales aparte).
const INACTIVITY_ID = "laystra.inactivity";

// Descanso entre series: notificación local para la hora de fin de la cuenta atrás.
// Mismo patrón que la de inactividad: id fijo (reprogramar sustituye, cancelar por id,
// nunca cancelAll para no tocar "habit-*" ni "laystra.inactivity").
// LIMITACIÓN: iOS no permite una alarma que suene en bucle como la del reloj; esto es
// el sonido estándar de una notificación local, y respeta el interruptor de silencio
// y los modos de Concentración. Con la app abierta no se muestra banner ni sonido
// (ver el handler): en su lugar hay un háptico.
const REST_ID = "laystra.rest";

// Las notificaciones locales programadas no existen en web (vista previa en
// navegador): todo lo de aviso de inactividad se salta ahí.
const NOTIFICATIONS_SUPPORTED = Platform.OS !== "web";

if (NOTIFICATIONS_SUPPORTED) {
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      // Fin de descanso con la app abierta: sin banner ni sonido (la pantalla ya
      // muestra la cuenta atrás en 0 y suena un háptico); no duplicar el aviso.
      const isRest = notification.request.identifier === REST_ID;
      return {
        shouldShowBanner: !isRest,
        shouldShowList: !isRest,
        shouldPlaySound: !isRest,
        shouldSetBadge: false,
      };
    },
  });
}

type SessionValue = {
  // true cuando ya se intentó restaurar el borrador guardado. Hasta entonces la
  // pantalla Sesión no debe reconstruir el formulario (machacaría lo restaurado).
  hydrated: boolean;
  // --- Sesión (cronómetro) ---
  // Hay una sesión abierta: preparada (sin cronómetro) o en marcha.
  active: boolean;
  // El cronómetro ya arrancó (primera serie completada). active && !running = "preparada".
  running: boolean;
  // ms epoch del inicio. Al reanudar tras una pausa se desplaza hacia delante lo
  // que duró la pausa, así (now - startedAt) nunca cuenta el tiempo pausado.
  startedAt: number | null;
  // ms epoch en que se pausó; null = corriendo. Con pausa, los relojes se congelan.
  pausedAt: number | null;
  paused: boolean;
  pauseSession: () => void;
  resumeSession: () => void;
  // Última serie completada (reps escritas); ancla del contador de descanso.
  lastSetAt: number | null;
  setLastSetAt: Dispatch<SetStateAction<number | null>>;
  // Cuenta atrás de descanso: ms epoch del fin (null = no hay). Si ya pasó, el
  // descanso terminó y se queda en 0 hasta saltarlo o completar otra serie.
  restEndAt: number | null;
  // Arranca (o reinicia) el descanso con la duración por defecto. Reprograma la notificación.
  startRest: () => void;
  // Suma/resta segundos al descanso en curso (restar hasta 0 equivale a saltarlo).
  adjustRest: (deltaSeconds: number) => void;
  // Descarta el descanso y cancela su notificación.
  skipRest: () => void;
  // true si el usuario no concedió permiso de notificaciones al empezar.
  notificationsDenied: boolean;
  // Abre la sesión SIN cronómetro (estado "preparada"): se pueden elegir ejercicios
  // y el tiempo no cuenta hasta startSession().
  prepareSession: () => void;
  // Arranca el cronómetro (se llama al completar la primera serie). Abre la sesión si no lo estaba.
  startSession: () => void;
  // Termina la sesión y descarta el borrador (el que ya se guardó está a salvo en el backend).
  stopSession: () => void;
  // Marca actividad: reprograma el aviso de inactividad.
  touch: () => void;

  // --- Borrador del entreno en curso ---
  formTarget: FormTarget | null;
  setFormTarget: Dispatch<SetStateAction<FormTarget | null>>;
  formRows: ExerciseDraft[];
  setFormRows: Dispatch<SetStateAction<ExerciseDraft[]>>;
  formError: string | null;
  setFormError: Dispatch<SetStateAction<string | null>>;
  submitted: boolean;
  setSubmitted: Dispatch<SetStateAction<boolean>>;
  skipped: boolean;
  setSkipped: Dispatch<SetStateAction<boolean>>;
  savedSummaries: SavedSummary[];
  setSavedSummaries: Dispatch<SetStateAction<SavedSummary[]>>;
  // "Guardar como rutina" ya hecho para el entreno libre actual (persiste en el borrador).
  routineSaved: boolean;
  setRoutineSaved: Dispatch<SetStateAction<boolean>>;
  // Pide que el próximo guardado del borrador sea inmediato (sin debounce).
  // Llamar justo antes de los setState que reflejan un guardado en el backend.
  persistNow: () => void;
  expandedAfterSave: Set<string>;
  setExpandedAfterSave: Dispatch<SetStateAction<Set<string>>>;
  notes: string;
  setNotes: Dispatch<SetStateAction<string>>;
  draftKeyRef: MutableRefObject<string | null>;
  snapshotRef: MutableRefObject<Snapshot | null>;
  // Inicio del tramo del entreno actual: arranca con la sesión y se mueve al
  // guardar, para que la duración de cada entreno no cuente el anterior.
  segmentStartRef: MutableRefObject<number | null>;
  nextSetId: () => number;
};

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (value === null) {
    throw new Error("useSession debe usarse dentro de <SessionProvider>");
  }
  return value;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [prepared, setPrepared] = useState(false);
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [lastSetAt, setLastSetAt] = useState<number | null>(null);
  const [restEndAt, setRestEndAt] = useState<number | null>(null);
  const [notificationsDenied, setNotificationsDenied] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [formRows, setFormRows] = useState<ExerciseDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [savedSummaries, setSavedSummaries] = useState<SavedSummary[]>([]);
  const [expandedAfterSave, setExpandedAfterSave] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");
  const [routineSaved, setRoutineSaved] = useState(false);
  const persistImmediateRef = useRef(false);
  const persistNow = useCallback(() => {
    persistImmediateRef.current = true;
  }, []);

  const draftKeyRef = useRef<string | null>(null);
  const snapshotRef = useRef<Snapshot | null>(null);
  const segmentStartRef = useRef<number | null>(null);
  const nextSetIdRef = useRef(1);
  const nextSetId = useCallback(() => nextSetIdRef.current++, []);

  const restEndRef = useRef<number | null>(null);
  const activeRef = useRef(false);
  const pausedRef = useRef(false);
  const pausedAtRef = useRef<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelInactivity = useCallback(async () => {
    if (!NOTIFICATIONS_SUPPORTED) {
      return;
    }
    try {
      await Notifications.cancelScheduledNotificationAsync(INACTIVITY_ID);
    } catch {
      // Sin módulo nativo / ya disparada: nada que cancelar.
    }
  }, []);

  const scheduleInactivity = useCallback(async () => {
    await cancelInactivity();
    if (!NOTIFICATIONS_SUPPORTED || !activeRef.current || pausedRef.current) {
      return;
    }
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: INACTIVITY_ID,
        content: { title: "Laystra", body: INACTIVITY_BODY, sound: true },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: INACTIVITY_SECONDS,
        },
      });
      // La sesión pudo terminar (o pausarse) mientras se programaba.
      if (!activeRef.current || pausedRef.current) {
        await Notifications.cancelScheduledNotificationAsync(INACTIVITY_ID);
      }
    } catch {
      // Notificaciones no disponibles o sin permiso: la sesión sigue funcionando.
    }
  }, [cancelInactivity]);

  // --- Descanso ---
  // Las operaciones async sobre "laystra.rest" (programar/cancelar) se serializan en
  // una cola de promesas: así dos reprogramaciones seguidas no se entrelazan (una
  // cancelando el aviso recién programado por la otra). Además, un contador de
  // generación hace que una operación pendiente que ya fue superada por otra más
  // reciente (o por una cancelación) no programe nada.
  const restQueueRef = useRef<Promise<void>>(Promise.resolve());
  const restGenRef = useRef(0);

  const enqueueRestOp = useCallback((op: () => Promise<void>) => {
    const next = restQueueRef.current.then(op, op);
    restQueueRef.current = next.catch(() => {});
  }, []);

  const cancelRestNotification = useCallback(() => {
    if (!NOTIFICATIONS_SUPPORTED) {
      return;
    }
    restGenRef.current += 1;
    enqueueRestOp(async () => {
      try {
        await Notifications.cancelScheduledNotificationAsync(REST_ID);
        await Notifications.dismissNotificationAsync(REST_ID);
      } catch {
        // Sin módulo nativo / ya disparada: nada que cancelar.
      }
    });
  }, [enqueueRestOp]);

  const scheduleRestNotification = useCallback(
    (endAt: number) => {
      if (!NOTIFICATIONS_SUPPORTED) {
        return;
      }
      const gen = ++restGenRef.current;
      enqueueRestOp(async () => {
        // Superada por otra programación o cancelación posterior: no hacer nada.
        if (gen !== restGenRef.current) {
          return;
        }
        try {
          await Notifications.cancelScheduledNotificationAsync(REST_ID);
          await Notifications.dismissNotificationAsync(REST_ID);
        } catch {
          // Nada que cancelar.
        }
        const seconds = Math.ceil((endAt - Date.now()) / 1000);
        if (seconds < 1 || !activeRef.current || pausedRef.current) {
          return;
        }
        try {
          await Notifications.scheduleNotificationAsync({
            identifier: REST_ID,
            content: { title: "Descanso terminado", body: "Toca la siguiente serie.", sound: true },
            trigger: {
              type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
              seconds,
            },
          });
          // Se saltó/pausó/terminó mientras se programaba (si fue otra programación,
          // ella misma cancelará y reprogramará después en la cola).
          if (!activeRef.current || pausedRef.current || restEndRef.current !== endAt) {
            await Notifications.cancelScheduledNotificationAsync(REST_ID);
          }
        } catch {
          // Notificaciones no disponibles o sin permiso: queda la cuenta atrás en pantalla.
        }
      });
    },
    [enqueueRestOp]
  );

  const updateRestEnd = useCallback((value: number | null) => {
    restEndRef.current = value;
    setRestEndAt(value);
  }, []);

  const startRest = useCallback(() => {
    if (!activeRef.current) {
      return; // sesión "preparada" o sin sesión: no hay descanso
    }
    // En pausa el reloj está congelado: la cuenta nace anclada al instante de pausa
    // y resumeSession la desplazará (y programará el aviso) al reanudar.
    const base = pausedAtRef.current ?? Date.now();
    const endAt = base + getRestSeconds() * 1000;
    updateRestEnd(endAt);
    // Guarda restEndAt ya, sin esperar al debounce (si matan la app, no se pierde).
    persistNow();
    scheduleRestNotification(endAt);
  }, [persistNow, scheduleRestNotification, updateRestEnd]);

  const skipRest = useCallback(() => {
    updateRestEnd(null);
    cancelRestNotification();
  }, [cancelRestNotification, updateRestEnd]);

  const adjustRest = useCallback(
    (deltaSeconds: number) => {
      const current = restEndRef.current;
      if (current === null) {
        return;
      }
      const now = pausedAtRef.current ?? Date.now();
      const next = Math.max(current, now) + deltaSeconds * 1000;
      if (next <= now) {
        skipRest();
        return;
      }
      updateRestEnd(next);
      void scheduleRestNotification(next);
    },
    [scheduleRestNotification, skipRest, updateRestEnd]
  );

  // Fin de la cuenta atrás con la app abierta: háptico. Los timers de JS se
  // congelan en segundo plano; si al volver ya pasó hace rato no se vibra (en ese
  // caso ya sonó la notificación).
  useEffect(() => {
    if (restEndAt === null || pausedAt !== null) {
      return;
    }
    const wait = restEndAt - Date.now();
    if (wait <= 0) {
      return;
    }
    const id = setTimeout(() => {
      if (AppState.currentState === "active" && Date.now() - restEndAt < 3000) {
        haptic.success();
      }
    }, wait);
    return () => clearTimeout(id);
  }, [restEndAt, pausedAt]);

  const touch = useCallback(() => {
    if (!activeRef.current || pausedRef.current) {
      return;
    }
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void scheduleInactivity();
    }, RESCHEDULE_DEBOUNCE_MS);
  }, [scheduleInactivity]);

  // El permiso se pide aquí (viene de un toque explícito), no al teclear la primera
  // serie: así el diálogo de iOS no se cruza con el teclado.
  const prepareSession = useCallback(() => {
    setPrepared(true);
    if (!NOTIFICATIONS_SUPPORTED) {
      return;
    }
    void (async () => {
      try {
        let { status } = await Notifications.getPermissionsAsync();
        if (status !== "granted") {
          ({ status } = await Notifications.requestPermissionsAsync());
        }
        setNotificationsDenied(status !== "granted");
      } catch {
        setNotificationsDenied(true);
      }
    })();
  }, []);

  const startSession = useCallback(() => {
    // activeRef = cronómetro en marcha; una sesión preparada (prepared) aún no lo está.
    if (activeRef.current) {
      return;
    }
    activeRef.current = true;
    setPrepared(false);
    const now = Date.now();
    setStartedAt(now);
    segmentStartRef.current = now;

    void scheduleInactivity();
  }, [scheduleInactivity]);

  const pauseSession = useCallback(() => {
    if (!activeRef.current || pausedRef.current) {
      return;
    }
    pausedRef.current = true;
    const now = Date.now();
    pausedAtRef.current = now;
    setPausedAt(now);
    // En pausa no hay "inactividad" que avisar.
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    void cancelInactivity();
    // El descanso queda congelado; su aviso no puede sonar durante la pausa.
    void cancelRestNotification();
  }, [cancelInactivity, cancelRestNotification]);

  const resumeSession = useCallback(() => {
    const pausedAtValue = pausedAtRef.current;
    if (!activeRef.current || !pausedRef.current || pausedAtValue === null) {
      return;
    }
    pausedRef.current = false;
    pausedAtRef.current = null;
    // Desplaza todos los anclajes lo que duró la pausa, para que ni la sesión ni
    // el descanso cuenten el tiempo pausado.
    const shift = Date.now() - pausedAtValue;
    setPausedAt(null);
    setStartedAt((s) => (s === null ? s : s + shift));
    setLastSetAt((l) => (l === null ? l : l + shift));
    if (restEndRef.current !== null) {
      // Misma lógica que lastSetAt: la pausa no consume descanso. Se reprograma el
      // aviso con el tiempo restante.
      const shifted = restEndRef.current + shift;
      updateRestEnd(shifted);
      void scheduleRestNotification(shifted);
    }
    if (segmentStartRef.current !== null) {
      segmentStartRef.current += shift;
    }
    // La cuenta de inactividad empieza de cero al reanudar.
    void scheduleInactivity();
  }, [scheduleInactivity, scheduleRestNotification, updateRestEnd]);

  const stopSession = useCallback(() => {
    activeRef.current = false;
    pausedRef.current = false;
    pausedAtRef.current = null;
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    void cancelInactivity();
    updateRestEnd(null);
    void cancelRestNotification();

    setStartedAt(null);
    setPrepared(false);
    setPausedAt(null);
    setLastSetAt(null);
    segmentStartRef.current = null;
    setNotes("");
    setFormTarget(null);
    setFormRows([]);
    setFormError(null);
    setSubmitted(false);
    setSkipped(false);
    setSavedSummaries([]);
    setRoutineSaved(false);
    setExpandedAfterSave(new Set());
    draftKeyRef.current = null;
    snapshotRef.current = null;

    // Borra el borrador guardado ya mismo (sin esperar al debounce).
    if (persistTimerRef.current !== null) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    void AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
  }, [cancelInactivity, cancelRestNotification, updateRestEnd]);

  // Restaurar al abrir la app (una sola vez). Si había una sesión guardada, se
  // reponen estado y refs (activeRef/pausedRef gobiernan las notificaciones) y,
  // sobre todo, draftKeyRef: SesionScreen recalcula la clave desde /today y, si
  // draftKeyRef fuera null, reconstruiría el formulario y pisaría lo restaurado.
  useEffect(() => {
    let cancelled = false;
    void loadRestSeconds();
    void (async () => {
      let draft: PersistedDraft | null = null;
      try {
        draft = parseDraft(await AsyncStorage.getItem(DRAFT_KEY));
      } catch {
        // Sin almacenamiento: se arranca sin borrador.
      }
      if (cancelled) {
        return;
      }
      // Un borrador de otro día (sesión olvidada de ayer) se descarta: restaurarlo
      // mezclaría la fecha vieja con la de hoy y la duración incluiría la noche.
      if (draft !== null && draftDay(draft) !== todayIsoDate()) {
        draft = null;
        void AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
      }
      if (draft !== null && !activeRef.current) {
        // startedAt null = sesión preparada: se restaura sin cronómetro, sin pausa y
        // sin aviso de inactividad (activeRef sigue en false hasta la primera serie).
        const wasRunning = draft.startedAt !== null;
        activeRef.current = wasRunning;
        pausedRef.current = wasRunning && draft.pausedAt !== null;
        pausedAtRef.current = wasRunning ? draft.pausedAt : null;
        segmentStartRef.current = wasRunning ? draft.segmentStart ?? draft.startedAt : null;
        draftKeyRef.current = draft.draftKey;
        snapshotRef.current = draft.snapshot;
        nextSetIdRef.current =
          Math.max(maxSetId(draft.formRows), maxSetId(draft.snapshot?.formRows ?? [])) + 1;
        setStartedAt(draft.startedAt);
        setPrepared(!wasRunning);
        setPausedAt(wasRunning ? draft.pausedAt : null);
        setLastSetAt(draft.lastSetAt);
        // Cuenta atrás de descanso: sobrevive a matar la app (hora de fin absoluta).
        // Solo con el cronómetro en marcha; si ya pasó se queda en 0.
        if (wasRunning && draft.restEndAt !== null) {
          updateRestEnd(draft.restEndAt);
          if (draft.pausedAt === null && draft.restEndAt > Date.now()) {
            void scheduleRestNotification(draft.restEndAt);
          }
        }
        setFormTarget(draft.formTarget);
        setFormRows(draft.formRows);
        setNotes(draft.notes);
        setSubmitted(draft.submitted);
        setSkipped(draft.skipped);
        setSavedSummaries(draft.savedSummaries);
        setRoutineSaved(draft.routineSaved);
        if (wasRunning && draft.pausedAt === null) {
          void scheduleInactivity();
        }
      }
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Guardar el borrador (con debounce: teclear dispara muchos cambios). Sin
  // sesión activa se borra. No escribe hasta haber restaurado, o pisaría el
  // borrador guardado con el estado vacío de arranque.
  useEffect(() => {
    if (!hydrated) {
      return;
    }
    if (persistTimerRef.current !== null) {
      clearTimeout(persistTimerRef.current);
    }
    const write = () => {
      persistTimerRef.current = null;
      if (startedAt === null && !prepared) {
        void AsyncStorage.removeItem(DRAFT_KEY).catch(() => {});
        return;
      }
      const payload: PersistedDraft = {
        savedAt: Date.now(),
        startedAt,
        pausedAt,
        lastSetAt,
        segmentStart: segmentStartRef.current,
        draftKey: draftKeyRef.current,
        formTarget,
        formRows,
        notes,
        submitted,
        skipped,
        savedSummaries,
        snapshot: snapshotRef.current,
        routineSaved,
        restEndAt,
      };
      void AsyncStorage.setItem(DRAFT_KEY, JSON.stringify(payload)).catch(() => {});
    };
    // Tras guardar un entreno en el backend se escribe ya (persistNow): si iOS mata
    // la app antes del debounce, al reabrir el borrador seguiría "sin guardar" y
    // permitiría duplicar el entreno.
    if (persistImmediateRef.current) {
      persistImmediateRef.current = false;
      write();
      return;
    }
    persistTimerRef.current = setTimeout(write, PERSIST_DEBOUNCE_MS);
  }, [
    hydrated,
    startedAt,
    prepared,
    pausedAt,
    lastSetAt,
    formTarget,
    formRows,
    notes,
    submitted,
    skipped,
    savedSummaries,
    routineSaved,
    restEndAt,
  ]);

  useEffect(
    () => () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
      if (persistTimerRef.current !== null) {
        clearTimeout(persistTimerRef.current);
      }
    },
    []
  );

  const value = useMemo<SessionValue>(
    () => ({
      hydrated,
      active: startedAt !== null || prepared,
      running: startedAt !== null,
      startedAt,
      pausedAt,
      paused: pausedAt !== null,
      pauseSession,
      resumeSession,
      lastSetAt,
      setLastSetAt,
      restEndAt,
      startRest,
      adjustRest,
      skipRest,
      notificationsDenied,
      prepareSession,
      startSession,
      stopSession,
      touch,
      formTarget,
      setFormTarget,
      formRows,
      setFormRows,
      formError,
      setFormError,
      submitted,
      setSubmitted,
      skipped,
      setSkipped,
      savedSummaries,
      setSavedSummaries,
      routineSaved,
      setRoutineSaved,
      persistNow,
      expandedAfterSave,
      setExpandedAfterSave,
      notes,
      setNotes,
      draftKeyRef,
      snapshotRef,
      segmentStartRef,
      nextSetId,
    }),
    [
      hydrated,
      startedAt,
      prepared,
      pausedAt,
      pauseSession,
      resumeSession,
      lastSetAt,
      restEndAt,
      startRest,
      adjustRest,
      skipRest,
      notificationsDenied,
      prepareSession,
      startSession,
      stopSession,
      touch,
      formTarget,
      formRows,
      formError,
      submitted,
      skipped,
      savedSummaries,
      routineSaved,
      persistNow,
      expandedAfterSave,
      notes,
      nextSetId,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
