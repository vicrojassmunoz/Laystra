import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import { Pressable, View } from "react-native";

import { fetchSchedule } from "../api/schedule";
import { fetchToday, todayIsoDate } from "../api/today";
import { fetchWaterDay } from "../api/water";
import { fetchWorkouts } from "../api/workouts";
import { Card, Section } from "../components/ui/Card";
import Row from "../components/ui/Row";
import Screen, { ScreenError, ScreenLoading } from "../components/ui/Screen";
import Txt from "../components/ui/Txt";
import { useSession } from "../session/SessionContext";
import { makeStyles, space, useTheme } from "../theme/theme";
import { ScheduleEntry } from "../types/schedule";
import { WaterDay } from "../types/water";
import { Workout } from "../types/workout";
import { formatMl } from "../utils/water";

const DAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];

type DayStatus = "descanso" | "entrenado" | "perdido" | "pendiente";

type DayInfo = {
  day: number; // 0 = lunes ... 6 = domingo, mismo convenio que ScheduleEntry.day
  date: string; // YYYY-MM-DD
  status: DayStatus;
  isToday: boolean;
};

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; days: DayInfo[]; water: WaterDay | null; routineName: string | null };

// Construye las 7 fechas locales (YYYY-MM-DD, sin drift UTC) de la semana
// que contiene "hoy", empezando en lunes -- mismo convenio de día que
// ScheduleEntry.day (0 = lunes ... 6 = domingo).
function buildWeekDates(): string[] {
  const now = new Date();
  const jsDay = now.getDay(); // 0 = domingo ... 6 = sábado
  const mondayOffset = (jsDay + 6) % 7; // días desde el lunes de esta semana
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
  }
  return dates;
}

function deriveDays(schedule: ScheduleEntry[], workouts: Workout[], todayIso: string): DayInfo[] {
  const weekDates = buildWeekDates();
  const workoutDates = new Set(workouts.map((w) => w.date));

  return weekDates.map((date, day) => {
    const entry = schedule.find((e) => e.day === day);
    const routineId = entry?.routine_id ?? null;
    const hasWorkout = workoutDates.has(date);

    // Entrenar cuenta como "entrenado" aunque el día esté marcado como
    // descanso (p. ej. un entreno libre) -- "descanso" solo describe un día
    // sin rutina asignada Y sin nada logueado, no una regla que deba respetarse.
    let dayStatus: DayStatus;
    if (hasWorkout) {
      dayStatus = "entrenado";
    } else if (routineId === null) {
      dayStatus = "descanso";
    } else if (date < todayIso) {
      dayStatus = "perdido";
    } else {
      dayStatus = "pendiente";
    }

    return { day, date, status: dayStatus, isToday: date === todayIso };
  });
}

const useStyles = makeStyles(({ colors }) => ({
  strip: { flexDirection: "row", justifyContent: "space-between", gap: space.sm },
  dayCell: { flex: 1, alignItems: "center", gap: space.xs },
  dayDot: {
    width: "100%",
    maxWidth: 44,
    aspectRatio: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  dayToday: { borderColor: colors.tint },
  stripHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
}));

export default function HomeScreen() {
  const navigation = useNavigation();
  const styles = useStyles();
  const { colors } = useTheme();
  const { active, paused } = useSession();
  const [state, setState] = useState<State>({ status: "loading" });
  const hasDataRef = useRef(false);

  const load = useCallback(() => {
    if (!hasDataRef.current) {
      setState({ status: "loading" });
    }
    const todayIso = todayIsoDate();

    // El agua y la rutina de hoy son opcionales en Home: si fallan (p. ej.
    // backend sin desplegar todavía), el hub sigue usable.
    Promise.all([
      fetchSchedule(),
      fetchWorkouts(),
      fetchWaterDay(todayIso).catch(() => null),
      fetchToday().catch(() => null),
    ])
      .then(([schedule, workouts, water, today]) => {
        hasDataRef.current = true;
        setState({
          status: "ready",
          days: deriveDays(schedule, workouts, todayIso),
          water,
          routineName: today?.routine_name ?? null,
        });
      })
      .catch((error: Error) => {
        if (!hasDataRef.current) {
          setState({ status: "error", message: error.message });
        }
      });
  }, []);

  // Corre cada vez que Home gana foco (no solo al montar), para reflejar
  // workouts logueados o cambios de calendario hechos en otras pantallas.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (state.status === "loading") {
    return <ScreenLoading />;
  }
  if (state.status === "error") {
    return <ScreenError message={state.message} />;
  }

  const { days, water, routineName } = state;

  const dotColors = (d: DayInfo): { bg: string; fg: string } => {
    switch (d.status) {
      case "entrenado":
        return { bg: colors.tint, fg: colors.onTint };
      case "perdido":
        return { bg: colors.dangerSoft, fg: colors.danger };
      case "descanso":
        return { bg: "transparent", fg: colors.labelTertiary };
      case "pendiente":
        return { bg: colors.fill, fg: colors.label };
    }
  };

  return (
    <Screen>
      <Pressable onPress={() => navigation.navigate("Semana")} accessibilityRole="button">
        <Card>
          <View style={styles.stripHeader}>
            <Txt variant="headline">Esta semana</Txt>
            <Txt variant="subhead" tone="tint">
              Ver semana
            </Txt>
          </View>
          <View style={[styles.strip, { marginTop: space.sm }]}>
            {days.map((d) => {
              const c = dotColors(d);
              return (
                <View key={d.day} style={styles.dayCell}>
                  <View
                    style={[styles.dayDot, { backgroundColor: c.bg }, d.isToday && styles.dayToday]}
                  >
                    <Txt variant="subhead" weight="600" style={{ color: c.fg }}>
                      {DAY_LABELS[d.day]}
                    </Txt>
                  </View>
                </View>
              );
            })}
          </View>
        </Card>
      </Pressable>

      <Section>
        <Row
          icon="train"
          title="Hoy"
          subtitle={
            active
              ? paused
                ? "Sesión en pausa"
                : "Sesión en curso"
              : routineName
                ? `Toca: ${routineName}`
                : "Día de descanso"
          }
          onPress={() => navigation.navigate("Hoy")}
        />
        <Row
          icon="water"
          iconTone="water"
          title="Agua"
          value={water ? `${formatMl(water.total_ml)} / ${formatMl(water.goal_ml)}` : undefined}
          onPress={() => navigation.navigate("Agua")}
        />
      </Section>

      <Section title="Seguimiento">
        <Row icon="history" title="Historial" onPress={() => navigation.navigate("Historial")} />
        <Row icon="progress" title="Progreso" onPress={() => navigation.navigate("Progreso")} />
        <Row icon="goals" title="Objetivos" onPress={() => navigation.navigate("Objetivos")} />
        <Row icon="analysis" title="Análisis" onPress={() => navigation.navigate("Analisis")} />
      </Section>

      <Section title="Planificación">
        <Row icon="routines" title="Rutinas" onPress={() => navigation.navigate("Rutinas")} />
        <Row icon="week" title="Semana" onPress={() => navigation.navigate("Semana")} />
      </Section>

      <Section>
        <Row icon="profile" title="Perfil" onPress={() => navigation.navigate("User")} />
      </Section>
    </Screen>
  );
}
