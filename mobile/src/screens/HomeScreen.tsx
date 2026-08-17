import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchSchedule } from "../api/schedule";
import { todayIsoDate } from "../api/today";
import { fetchWorkouts } from "../api/workouts";
import MenuTile from "../components/MenuTile";
import { ScheduleEntry } from "../types/schedule";
import { Workout } from "../types/workout";

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
  | { status: "ready"; days: DayInfo[] };

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

export default function HomeScreen() {
  const navigation = useNavigation();
  const [state, setState] = useState<State>({ status: "loading" });
  const hasDataRef = useRef(false);

  const load = useCallback(() => {
    if (!hasDataRef.current) {
      setState({ status: "loading" });
    }

    Promise.all([fetchSchedule(), fetchWorkouts()])
      .then(([schedule, workouts]) => {
        hasDataRef.current = true;
        setState({ status: "ready", days: deriveDays(schedule, workouts, todayIsoDate()) });
      })
      .catch((error: Error) => {
        if (!hasDataRef.current) {
          setState({ status: "error", message: error.message });
        }
      });
  }, []);

  // Corre cada vez que la pestaña "Home" gana foco (no solo al montar), para
  // reflejar workouts logueados o cambios de calendario hechos en otras pestañas.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function goToWeek() {
    navigation.navigate("Tabs", { screen: "Semana" });
  }

  if (state.status === "loading") {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (state.status === "error") {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <Text style={styles.title}>No se pudo conectar con el backend</Text>
        <Text style={styles.errorDetail}>{state.message}</Text>
      </SafeAreaView>
    );
  }

  const { days } = state;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Laystra</Text>

        <TouchableOpacity onPress={goToWeek}>
          <View style={styles.weekStrip}>
            {days.map((d) => (
              <View
                key={d.day}
                style={[
                  styles.dayIndicator,
                  dayIndicatorStyle(d.status),
                  d.isToday && styles.dayIndicatorToday,
                ]}
              >
                <Text style={[styles.dayIndicatorLabel, dayIndicatorTextStyle(d.status)]}>
                  {DAY_LABELS[d.day]}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.weekStripLink}>Ver semana ›</Text>
        </TouchableOpacity>

        <View style={styles.menuGrid}>
          <MenuTile
            label="Objetivos"
            variant="fullWidth"
            onPress={() => navigation.navigate("Objetivos")}
          />

          <View style={styles.menuRow}>
            <MenuTile label="Perfil" variant="half" onPress={() => navigation.navigate("User")} />
            <MenuTile
              label="Análisis"
              variant="half"
              onPress={() => navigation.navigate("Analisis")}
            />
          </View>

          <View style={styles.menuRow}>
            <MenuTile
              label="Rutinas"
              variant="half"
              onPress={() => navigation.navigate("Tabs", { screen: "Rutinas" })}
            />
            <MenuTile
              label="Historial"
              variant="half"
              onPress={() => navigation.navigate("Tabs", { screen: "Historial" })}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function dayIndicatorStyle(status: DayStatus) {
  switch (status) {
    case "entrenado":
      return { backgroundColor: "#c6f6d5" };
    case "perdido":
      return { backgroundColor: "#f8d7da" };
    case "descanso":
      return { backgroundColor: "#e2e8f0" };
    case "pendiente":
      return { backgroundColor: "#f4f4f4" };
  }
}

function dayIndicatorTextStyle(status: DayStatus) {
  switch (status) {
    case "entrenado":
      return { color: "#1b8a1b" };
    case "perdido":
      return { color: "#b00020" };
    case "descanso":
      return { color: "#888" };
    case "pendiente":
      return { color: "#555" };
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
  },
  weekStrip: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayIndicator: {
    flex: 1,
    marginHorizontal: 3,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  dayIndicatorToday: {
    borderColor: "#333",
  },
  dayIndicatorLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  weekStripLink: {
    fontSize: 13,
    color: "#555",
    textAlign: "right",
    marginTop: 6,
    marginBottom: 24,
  },
  menuGrid: {
    gap: 12,
  },
  menuRow: {
    flexDirection: "row",
    gap: 12,
  },
  errorDetail: {
    fontSize: 14,
    color: "#b00020",
    marginTop: 8,
    textAlign: "center",
  },
});
