import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchRoutines } from "../api/routines";
import { fetchToday, todayIsoDate, TodayResponse } from "../api/today";
import { fetchWaterDay } from "../api/water";
import { fetchWorkouts } from "../api/workouts";
import SessionClock from "../components/SessionClock";
import { useSession } from "../session/SessionContext";
import { Routine } from "../types/routine";
import { WaterDay } from "../types/water";
import { Workout } from "../types/workout";
import { formatMl } from "../utils/water";
import { toKg } from "../utils/weightUnit";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      today: TodayResponse;
      routines: Routine[];
      workouts: Workout[]; // solo los de hoy
      water: WaterDay | null;
    };

function longDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const text = new Date(y, m - 1, d).toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function workoutStats(workout: Workout): { exercises: number; sets: number; volumeKg: number } {
  const exercises = new Set(workout.sets.map((s) => s.exercise_id)).size;
  const volumeKg = workout.sets.reduce(
    (sum, s) => sum + toKg(s.weight, s.unit ?? "kg") * s.reps,
    0
  );
  return { exercises, sets: workout.sets.length, volumeKg };
}

// Hoy = resumen del día. Loguear (series, sensaciones, cronómetro) vive en
// "Sesión", que se abre desde aquí y sigue viva si sales a otras pantallas.
export default function HoyScreen() {
  const navigation = useNavigation();
  const { active, startedAt, startSession, notificationsDenied } = useSession();
  const [state, setState] = useState<State>({ status: "loading" });
  const hasDataRef = useRef(false);

  const load = useCallback(() => {
    if (!hasDataRef.current) {
      setState({ status: "loading" });
    }
    const todayIso = todayIsoDate();

    Promise.all([
      fetchToday(),
      fetchRoutines(),
      fetchWorkouts(),
      // El agua es opcional aquí: si falla, el resto del resumen sigue.
      fetchWaterDay(todayIso).catch(() => null),
    ])
      .then(([today, routines, workouts, water]) => {
        hasDataRef.current = true;
        setState({
          status: "ready",
          today,
          routines,
          workouts: workouts.filter((w) => w.date === todayIso),
          water,
        });
      })
      .catch((error: Error) => {
        if (!hasDataRef.current) {
          setState({ status: "error", message: error.message });
        }
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function openSession() {
    if (!active) {
      startSession();
    }
    navigation.navigate("Sesion");
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

  const { today, routines, workouts, water } = state;
  const routineById = new Map(routines.map((r) => [r.id, r]));
  const totalVolumeKg = workouts.reduce((sum, w) => sum + workoutStats(w).volumeKg, 0);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Hoy</Text>
        <Text style={styles.date}>{longDate(today.date)}</Text>

        <View style={[styles.card, active && styles.cardActive]}>
          {active && startedAt !== null ? (
            <>
              <Text style={styles.cardLabel}>Sesión en curso</Text>
              <SessionClock startedAt={startedAt} style={styles.bigClock} />
              <View style={styles.cardButton}>
                <Button title="Volver a la sesión" onPress={openSession} />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.cardLabel}>
                {today.routine_name ? `Toca: ${today.routine_name}` : "Día de descanso"}
              </Text>
              <Text style={styles.muted}>
                {today.exercises.length > 0
                  ? `${today.exercises.length} ejercicio${today.exercises.length === 1 ? "" : "s"} planificados`
                  : "Puedes entrenar igualmente: elige una rutina o un entreno libre dentro de la sesión."}
              </Text>
              <View style={styles.cardButton}>
                <Button title="▶ Empezar sesión" onPress={openSession} />
              </View>
            </>
          )}
          {active && notificationsDenied && (
            <Text style={styles.warning}>
              Sin permiso de notificaciones: no te avisaré si pasas 2 h sin registrar nada.
            </Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Entrenos de hoy</Text>
        {workouts.length === 0 && <Text style={styles.muted}>Aún no has guardado nada hoy.</Text>}
        {workouts.map((workout) => {
          const stats = workoutStats(workout);
          const name =
            workout.routine_id != null
              ? routineById.get(workout.routine_id)?.name ?? `Rutina #${workout.routine_id}`
              : "Entreno libre";
          return (
            <View key={workout.id} style={styles.card}>
              <Text style={styles.workoutName}>{name}</Text>
              <Text style={styles.muted}>
                {stats.exercises} ejercicio{stats.exercises === 1 ? "" : "s"} · {stats.sets} serie
                {stats.sets === 1 ? "" : "s"} · {Math.round(stats.volumeKg)} kg de volumen
              </Text>
              {workout.notes ? <Text style={styles.notes}>📝 {workout.notes}</Text> : null}
            </View>
          );
        })}
        {workouts.length > 1 && (
          <Text style={styles.muted}>Total hoy: {Math.round(totalVolumeKg)} kg de volumen</Text>
        )}

        <Text style={styles.sectionTitle}>Agua</Text>
        <TouchableOpacity style={styles.card} onPress={() => navigation.navigate("Agua")}>
          <Text style={styles.workoutName}>
            💧{" "}
            {water
              ? `${formatMl(water.total_ml)} / ${formatMl(water.goal_ml)}`
              : "No disponible"}
          </Text>
          <Text style={styles.link}>Abrir Agua ›</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: "600" },
  date: { fontSize: 15, color: "#555", marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginTop: 16, marginBottom: 8 },
  card: { backgroundColor: "#f4f4f4", borderRadius: 8, padding: 14, marginBottom: 10 },
  cardActive: { backgroundColor: "#e6f6e9", borderWidth: 1, borderColor: "#7fd18b" },
  cardLabel: { fontSize: 18, fontWeight: "600", marginBottom: 4 },
  cardButton: { marginTop: 12 },
  bigClock: { fontSize: 40, fontWeight: "700", fontVariant: ["tabular-nums"] },
  workoutName: { fontSize: 17, fontWeight: "600", marginBottom: 2 },
  muted: { fontSize: 14, color: "#555" },
  notes: { fontSize: 14, color: "#555", fontStyle: "italic", marginTop: 6 },
  link: { fontSize: 14, color: "#3b5bdb", marginTop: 6 },
  warning: { fontSize: 13, color: "#b8860b", marginTop: 10 },
  errorDetail: { fontSize: 14, color: "#b00020", marginTop: 8 },
});
