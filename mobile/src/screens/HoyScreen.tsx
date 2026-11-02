import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import { Pressable, View } from "react-native";

import { fetchExercises } from "../api/exercises";
import { fetchRoutines } from "../api/routines";
import { fetchToday, todayIsoDate, TodayResponse } from "../api/today";
import { fetchWaterDay } from "../api/water";
import { fetchWorkouts } from "../api/workouts";
import SessionClock from "../components/SessionClock";
import Button from "../components/ui/Button";
import { Card, SectionHeader } from "../components/ui/Card";
import Icon from "../components/ui/Icon";
import FadeInView from "../components/ui/FadeInView";
import PressableScale from "../components/ui/PressableScale";
import ProgressBar from "../components/ui/ProgressBar";
import Screen, { ScreenError, ScreenLoading } from "../components/ui/Screen";
import Txt from "../components/ui/Txt";
import { haptic } from "../motion/motion";
import { INACTIVITY_LABEL, useSession } from "../session/SessionContext";
import { makeStyles, space, useTheme } from "../theme/theme";
import { Exercise } from "../types/exercise";
import { Routine } from "../types/routine";
import { WaterDay } from "../types/water";
import { Workout } from "../types/workout";
import { formatMl } from "../utils/water";
import { summarizeByExercise, workoutStats } from "../utils/workoutSummary";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      today: TodayResponse;
      routines: Routine[];
      exercises: Exercise[];
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

const useStyles = makeStyles(({ colors }) => ({
  statusRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  workoutHead: { flexDirection: "row", alignItems: "center", gap: space.sm },
  exerciseBlock: {
    paddingTop: space.md,
    marginTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
    gap: 2,
  },
  toggle: { flexDirection: "row", alignItems: "center", gap: space.xs, minHeight: 36 },
  notes: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  waterTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
}));

// Hoy = resumen del día. Loguear (series, sensaciones, cronómetro) vive en
// "Sesión", que se abre desde aquí y sigue viva si sales a otras pantallas.
export default function HoyScreen() {
  const navigation = useNavigation();
  const styles = useStyles();
  const { colors } = useTheme();
  const { active, startedAt, pausedAt, startSession, notificationsDenied } = useSession();
  const [state, setState] = useState<State>({ status: "loading" });
  const hasDataRef = useRef(false);
  // Entrenos de hoy desplegados (ids). Vacío = todos recogidos.
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  function toggleExpanded(workoutId: number) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(workoutId)) {
        next.delete(workoutId);
      } else {
        next.add(workoutId);
      }
      return next;
    });
  }

  const load = useCallback(() => {
    if (!hasDataRef.current) {
      setState({ status: "loading" });
    }
    const todayIso = todayIsoDate();

    Promise.all([
      fetchToday(),
      fetchRoutines(),
      // Solo para poner nombre a los ejercicios del desplegable; si falla se
      // muestran como "Ejercicio #id" en vez de romper el resumen.
      fetchExercises().catch(() => [] as Exercise[]),
      fetchWorkouts(),
      // El agua es opcional aquí: si falla, el resto del resumen sigue.
      fetchWaterDay(todayIso).catch(() => null),
    ])
      .then(([today, routines, exercises, workouts, water]) => {
        hasDataRef.current = true;
        setState({
          status: "ready",
          today,
          routines,
          exercises,
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
      haptic.light();
      startSession();
    }
    navigation.navigate("Sesion");
  }

  if (state.status === "loading") {
    return <ScreenLoading />;
  }
  if (state.status === "error") {
    return <ScreenError message={state.message} />;
  }

  const { today, routines, exercises, workouts, water } = state;
  const routineById = new Map(routines.map((r) => [r.id, r]));
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const totalVolumeKg = workouts.reduce((sum, w) => sum + workoutStats(w).volumeKg, 0);
  const paused = pausedAt !== null;
  const waterProgress = water && water.goal_ml > 0 ? water.total_ml / water.goal_ml : 0;

  return (
    <Screen>
      <Txt variant="subhead" tone="secondary">
        {longDate(today.date)}
      </Txt>

      <Card>
        {active && startedAt !== null ? (
          <>
            <View style={styles.statusRow}>
              <View
                style={[styles.dot, { backgroundColor: paused ? colors.warning : colors.success }]}
              />
              <Txt variant="subhead" tone={paused ? "warning" : "success"} weight="600">
                {paused ? "Sesión en pausa" : "Sesión en curso"}
              </Txt>
            </View>
            <SessionClock
              startedAt={startedAt}
              pausedAt={pausedAt}
              variant="largeTitle"
              tone={paused ? "secondary" : "label"}
            />
            <View style={{ marginTop: space.sm }}>
              <Button
                title="Volver a la sesión"
                variant="filled"
                size="large"
                icon="train"
                fullWidth
                onPress={openSession}
              />
            </View>
            {notificationsDenied ? (
              <Txt variant="footnote" tone="warning" style={{ marginTop: space.xs }}>
                Sin permiso de notificaciones: no te avisaré si pasas {INACTIVITY_LABEL} sin
                registrar nada.
              </Txt>
            ) : null}
          </>
        ) : (
          <>
            <Txt variant="title3">
              {today.routine_name ? `Toca: ${today.routine_name}` : "Día de descanso"}
            </Txt>
            <Txt variant="subhead" tone="secondary">
              {today.exercises.length > 0
                ? `${today.exercises.length} ejercicio${today.exercises.length === 1 ? "" : "s"} planificados`
                : "Puedes entrenar igualmente: elige una rutina o un entreno libre dentro de la sesión."}
            </Txt>
            <View style={{ marginTop: space.sm }}>
              <Button
                title="Empezar sesión"
                variant="filled"
                size="large"
                icon="play"
                fullWidth
                onPress={openSession}
              />
            </View>
          </>
        )}
      </Card>

      <View>
        <SectionHeader>Entrenos de hoy</SectionHeader>
        {workouts.length === 0 ? (
          <Card>
            <Txt variant="subhead" tone="secondary">
              Aún no has guardado nada hoy.
            </Txt>
          </Card>
        ) : (
          <View style={{ gap: space.md }}>
            {workouts.map((workout) => {
              const stats = workoutStats(workout);
              const name =
                workout.routine_id != null
                  ? routineById.get(workout.routine_id)?.name ?? `Rutina #${workout.routine_id}`
                  : "Entreno libre";
              const isOpen = expanded.has(workout.id);

              return (
                <Card key={workout.id}>
                  <View style={styles.workoutHead}>
                    <Icon name="check" size={20} color={colors.success} />
                    <Txt variant="headline" style={{ flex: 1 }}>
                      {name}
                    </Txt>
                  </View>
                  <Txt variant="subhead" tone="secondary" numeric>
                    {stats.exercises} ejercicio{stats.exercises === 1 ? "" : "s"} · {stats.sets} serie
                    {stats.sets === 1 ? "" : "s"} · {Math.round(stats.volumeKg)} kg de volumen
                  </Txt>
                  {workout.notes ? (
                    <View style={styles.notes}>
                      <Icon name="note" size={16} color={colors.labelSecondary} />
                      <Txt variant="subhead" tone="secondary" style={{ flex: 1 }}>
                        {workout.notes}
                      </Txt>
                    </View>
                  ) : null}

                  <Pressable
                    onPress={() => toggleExpanded(workout.id)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    style={styles.toggle}
                  >
                    <Txt variant="subhead" tone="tint" weight="600">
                      {isOpen ? "Ocultar ejercicios" : "Ver ejercicios"}
                    </Txt>
                    <Icon name={isOpen ? "collapse" : "expand"} size={13} color={colors.tint} />
                  </Pressable>

                  {isOpen ? (
                    <FadeInView>
                      {summarizeByExercise(workout.sets, exerciseById).map((exercise) => (
                        <View key={exercise.exerciseId} style={styles.exerciseBlock}>
                          <Txt variant="callout" weight="600">
                            {exercise.name}
                          </Txt>
                          <Txt variant="subhead" tone="secondary" numeric>
                            {exercise.line}
                          </Txt>
                        </View>
                      ))}
                    </FadeInView>
                  ) : null}
                </Card>
              );
            })}
            {workouts.length > 1 ? (
              <Txt variant="footnote" tone="secondary" style={{ paddingHorizontal: space.lg }}>
                Total hoy: {Math.round(totalVolumeKg)} kg de volumen
              </Txt>
            ) : null}
          </View>
        )}
      </View>

      <View>
        <SectionHeader>Agua</SectionHeader>
        <PressableScale
          onPress={() => navigation.navigate("Agua")}
          accessibilityRole="button"
          scaleTo={0.98}
          dimTo={1}
        >
          <Card>
            {water ? (
              <>
                <View style={styles.waterTop}>
                  <Txt variant="title3" numeric>
                    {formatMl(water.total_ml)}
                  </Txt>
                  <Txt variant="subhead" tone="secondary" numeric>
                    de {formatMl(water.goal_ml)}
                  </Txt>
                </View>
                <ProgressBar
                  value={waterProgress}
                  tone={water.total_ml >= water.goal_ml ? "success" : "water"}
                />
              </>
            ) : (
              <Txt variant="subhead" tone="secondary">
                Agua no disponible ahora mismo.
              </Txt>
            )}
          </Card>
        </PressableScale>
      </View>
    </Screen>
  );
}
