import * as Notifications from "expo-notifications";
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

import { TodayExercise } from "../api/today";
import { SetDraft } from "../components/SupersetBlock";

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

// "¿Sigues por aquí?": si pasan 2 h sin teclear nada nuevo en la sesión, llega
// una notificación local. Se programa en el sistema (no depende de que la app
// siga viva en primer plano) y se reprograma en cada actividad.
const INACTIVITY_SECONDS = 2 * 60 * 60;
const INACTIVITY_BODY = "Ey, ¿sigues por aquí? Llevas 2 h sin registrar nada en tu sesión.";
// Teclear dispara muchos touch(): se agrupan para no reprogramar en cada tecla.
const RESCHEDULE_DEBOUNCE_MS = 2000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

type SessionValue = {
  // --- Sesión (cronómetro) ---
  active: boolean;
  startedAt: number | null;
  // Última serie completada (reps escritas); ancla del contador de descanso.
  lastSetAt: number | null;
  setLastSetAt: Dispatch<SetStateAction<number | null>>;
  // true si el usuario no concedió permiso de notificaciones al empezar.
  notificationsDenied: boolean;
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
  const [lastSetAt, setLastSetAt] = useState<number | null>(null);
  const [notificationsDenied, setNotificationsDenied] = useState(false);

  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [formRows, setFormRows] = useState<ExerciseDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const [savedSummaries, setSavedSummaries] = useState<SavedSummary[]>([]);
  const [expandedAfterSave, setExpandedAfterSave] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState("");

  const draftKeyRef = useRef<string | null>(null);
  const snapshotRef = useRef<Snapshot | null>(null);
  const segmentStartRef = useRef<number | null>(null);
  const nextSetIdRef = useRef(1);
  const nextSetId = useCallback(() => nextSetIdRef.current++, []);

  const activeRef = useRef(false);
  const notificationIdRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelInactivity = useCallback(async () => {
    const id = notificationIdRef.current;
    notificationIdRef.current = null;
    if (id === null) {
      return;
    }
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // Sin módulo nativo / ya disparada: nada que cancelar.
    }
  }, []);

  const scheduleInactivity = useCallback(async () => {
    await cancelInactivity();
    if (!activeRef.current) {
      return;
    }
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: { title: "Laystra", body: INACTIVITY_BODY, sound: true },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: INACTIVITY_SECONDS,
        },
      });
      // La sesión pudo terminar mientras se programaba.
      if (activeRef.current) {
        notificationIdRef.current = id;
      } else {
        await Notifications.cancelScheduledNotificationAsync(id);
      }
    } catch {
      // Notificaciones no disponibles o sin permiso: la sesión sigue funcionando.
    }
  }, [cancelInactivity]);

  const touch = useCallback(() => {
    if (!activeRef.current) {
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

  const startSession = useCallback(() => {
    if (activeRef.current) {
      return;
    }
    activeRef.current = true;
    const now = Date.now();
    setStartedAt(now);
    segmentStartRef.current = now;

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
      await scheduleInactivity();
    })();
  }, [scheduleInactivity]);

  const stopSession = useCallback(() => {
    activeRef.current = false;
    if (debounceRef.current !== null) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    void cancelInactivity();

    setStartedAt(null);
    setLastSetAt(null);
    segmentStartRef.current = null;
    setNotes("");
    setFormTarget(null);
    setFormRows([]);
    setFormError(null);
    setSubmitted(false);
    setSkipped(false);
    setSavedSummaries([]);
    setExpandedAfterSave(new Set());
    draftKeyRef.current = null;
    snapshotRef.current = null;
  }, [cancelInactivity]);

  useEffect(
    () => () => {
      if (debounceRef.current !== null) {
        clearTimeout(debounceRef.current);
      }
    },
    []
  );

  const value = useMemo<SessionValue>(
    () => ({
      active: startedAt !== null,
      startedAt,
      lastSetAt,
      setLastSetAt,
      notificationsDenied,
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
      startedAt,
      lastSetAt,
      notificationsDenied,
      startSession,
      stopSession,
      touch,
      formTarget,
      formRows,
      formError,
      submitted,
      skipped,
      savedSummaries,
      expandedAfterSave,
      notes,
      nextSetId,
    ]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
