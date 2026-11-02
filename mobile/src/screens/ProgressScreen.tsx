import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";

import { fetchExercises } from "../api/exercises";
import { fetchProgress } from "../api/progress";
import { fetchWorkouts } from "../api/workouts";
import BarChart from "../components/BarChart";
import Button from "../components/ui/Button";
import { Card, Section, SectionHeader } from "../components/ui/Card";
import Icon from "../components/ui/Icon";
import Row from "../components/ui/Row";
import Screen, { ScreenError, ScreenLoading } from "../components/ui/Screen";
import Txt from "../components/ui/Txt";
import { makeStyles, space, useTheme } from "../theme/theme";
import { Exercise } from "../types/exercise";
import { ProgressResponse } from "../types/progress";
import { Workout } from "../types/workout";
import { toKg } from "../utils/weightUnit";
import { dayLabel } from "../utils/workoutSummary";
import { formatWeightUnit } from "../utils/weightUnit";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; exercises: Exercise[]; workouts: Workout[] };

type DetailState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ProgressResponse };

// Resumen por ejercicio calculado en el cliente a partir del historial ya
// cargado (una sola petición, sin pedir /progress de cada ejercicio).
type Overview = {
  exercise: Exercise;
  sessions: number;
  lastDate: string;
  bestWeight: number;
  bestUnit: string;
};

function weightText(weight: number, unit: string): string {
  return unit === "bw" ? (weight > 0 ? `PC ${weight} kg` : "PC") : `${weight} ${formatWeightUnit(unit)}`;
}

function buildOverviews(exercises: Exercise[], workouts: Workout[]): Overview[] {
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const acc = new Map<
    number,
    { sessions: Set<number>; lastDate: string; bestKg: number; bestWeight: number; bestUnit: string }
  >();

  for (const workout of workouts) {
    for (const set of workout.sets) {
      const exercise = exerciseById.get(set.exercise_id);
      if (!exercise) continue;
      const unit = set.unit ?? exercise.unit;
      const kg = toKg(set.weight, unit);
      const entry = acc.get(set.exercise_id);
      if (!entry) {
        acc.set(set.exercise_id, {
          sessions: new Set([workout.id]),
          lastDate: workout.date,
          bestKg: kg,
          bestWeight: set.weight,
          bestUnit: unit,
        });
      } else {
        entry.sessions.add(workout.id);
        if (workout.date > entry.lastDate) entry.lastDate = workout.date;
        if (kg > entry.bestKg) {
          entry.bestKg = kg;
          entry.bestWeight = set.weight;
          entry.bestUnit = unit;
        }
      }
    }
  }

  return Array.from(acc.entries())
    .map(([id, v]) => ({
      exercise: exerciseById.get(id)!,
      sessions: v.sessions.size,
      lastDate: v.lastDate,
      bestWeight: v.bestWeight,
      bestUnit: v.bestUnit,
    }))
    .sort((a, b) => (a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : 0));
}

const useStyles = makeStyles(() => ({
  statsRow: { flexDirection: "row", justifyContent: "space-between", gap: space.lg },
  stat: { flex: 1, gap: 2 },
  trophyValue: { flexDirection: "row", alignItems: "center", gap: space.xs },
}));

// Progreso: primero tus ejercicios con datos (los más recientes arriba); al
// tocar uno, su evolución en gráfico y sesión a sesión.
export default function ProgressScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [state, setState] = useState<State>({ status: "loading" });
  const hasDataRef = useRef(false);

  const [selected, setSelected] = useState<Exercise | null>(null);
  const selectedRef = useRef<Exercise | null>(null);
  const [detail, setDetail] = useState<DetailState>({ status: "loading" });
  const requestRef = useRef(0);

  const load = useCallback(() => {
    if (!hasDataRef.current) {
      setState({ status: "loading" });
    }

    Promise.all([fetchExercises(), fetchWorkouts()])
      .then(([exercises, workouts]) => {
        hasDataRef.current = true;
        setState({ status: "ready", exercises, workouts });
      })
      .catch((error: Error) => {
        if (!hasDataRef.current) {
          setState({ status: "error", message: error.message });
        }
      });
  }, []);

  const loadDetail = useCallback((exerciseId: number) => {
    const requestId = ++requestRef.current;
    setDetail({ status: "loading" });
    fetchProgress(exerciseId)
      .then((data) => {
        // Descarta respuestas viejas (otro ejercicio o un refetch más nuevo).
        if (requestId === requestRef.current && selectedRef.current?.id === data.exercise_id) {
          setDetail({ status: "ready", data });
        }
      })
      .catch((error: Error) => {
        if (requestId === requestRef.current && selectedRef.current?.id === exerciseId) {
          setDetail({ status: "error", message: error.message });
        }
      });
  }, []);

  // Corre cada vez que la pantalla gana foco (no solo al montar), para reflejar
  // entrenos guardados desde la última visita. Lee selectedRef (no el state)
  // para no atar este callback a `selected`.
  useFocusEffect(
    useCallback(() => {
      load();
      if (selectedRef.current) {
        loadDetail(selectedRef.current.id);
      }
    }, [load, loadDetail])
  );

  function select(exercise: Exercise | null) {
    setSelected(exercise);
    selectedRef.current = exercise;
    if (exercise) {
      loadDetail(exercise.id);
    }
  }

  if (state.status === "loading") {
    return <ScreenLoading />;
  }
  if (state.status === "error") {
    return <ScreenError message={state.message} />;
  }

  // ---------- Detalle de un ejercicio ----------
  if (selected) {
    const unit = selected.unit;
    return (
      <Screen>
        <View style={{ alignSelf: "flex-start", marginLeft: -space.sm }}>
          <Button title="Todos los ejercicios" variant="plain" size="compact" onPress={() => select(null)} />
        </View>
        <Txt variant="title2">{selected.name}</Txt>

        {detail.status === "loading" ? <ScreenLoadingInline /> : null}
        {detail.status === "error" ? (
          <Txt variant="subhead" tone="danger">
            {detail.message}
          </Txt>
        ) : null}

        {detail.status === "ready" && detail.data.points.length === 0 ? (
          <Card>
            <Txt variant="subhead" tone="secondary">
              Sin entrenos registrados todavía.
            </Txt>
          </Card>
        ) : null}

        {detail.status === "ready" && detail.data.points.length > 0
          ? (() => {
              const points = detail.data.points; // de más antiguo a más reciente
              const kgOf = (p: (typeof points)[number]) => toKg(p.best_weight, p.unit ?? unit);
              const best = points.reduce((w, p) => (kgOf(p) > kgOf(w) ? p : w));
              const last = points[points.length - 1];
              const recent = points.slice(-16);
              const bestUnit = best.unit ?? unit;
              return (
                <>
                  <Card>
                    <View style={styles.statsRow}>
                      <View style={styles.stat}>
                        <Txt variant="footnote" tone="secondary">
                          Mejor peso
                        </Txt>
                        <View style={styles.trophyValue}>
                          <Icon name="trophy" size={16} color={colors.gold} />
                          <Txt variant="headline" numeric>
                            {weightText(best.best_weight, bestUnit)}
                          </Txt>
                        </View>
                      </View>
                      <View style={styles.stat}>
                        <Txt variant="footnote" tone="secondary">
                          Último
                        </Txt>
                        <Txt variant="headline" numeric>
                          {weightText(last.best_weight, last.unit ?? unit)}
                        </Txt>
                      </View>
                      <View style={styles.stat}>
                        <Txt variant="footnote" tone="secondary">
                          Sesiones
                        </Txt>
                        <Txt variant="headline" numeric>
                          {points.length}
                        </Txt>
                      </View>
                    </View>
                  </Card>

                  <View>
                    <SectionHeader>Mejor peso por sesión</SectionHeader>
                    <Card>
                      {points.length >= 3 ? (
                        <BarChart
                          bars={recent.map((p) => ({ value: kgOf(p), highlight: p === best }))}
                          maxLabel={weightText(best.best_weight, bestUnit)}
                          startLabel={dayLabel(recent[0].date)}
                          endLabel={dayLabel(recent[recent.length - 1].date)}
                          accessibilityLabel={`Gráfico de ${recent.length} sesiones. Mejor peso ${weightText(best.best_weight, bestUnit)}`}
                        />
                      ) : (
                        <Txt variant="subhead" tone="secondary">
                          Con 3 sesiones o más verás aquí la gráfica de tu evolución.
                        </Txt>
                      )}
                    </Card>
                  </View>

                  <Section title="Sesiones">
                    {points
                      .slice()
                      .reverse()
                      .map((point) => (
                        <Row
                          key={point.workout_id}
                          title={dayLabel(point.date)}
                          subtitle={`${point.total_reps} reps en total`}
                          value={
                            <View style={styles.trophyValue}>
                              {point === best ? (
                                <Icon name="trophy" size={15} color={colors.gold} />
                              ) : null}
                              <Txt variant="body" tone="secondary" numeric>
                                {weightText(point.best_weight, point.unit ?? unit)}
                              </Txt>
                            </View>
                          }
                        />
                      ))}
                  </Section>
                </>
              );
            })()
          : null}
      </Screen>
    );
  }

  // ---------- Lista de ejercicios con datos ----------
  const overviews = buildOverviews(state.exercises, state.workouts);

  return (
    <Screen>
      {overviews.length === 0 ? (
        <Card>
          <Txt variant="headline">Aún no hay datos</Txt>
          <Txt variant="subhead" tone="secondary">
            Cuando guardes entrenos verás aquí cada ejercicio con su mejor peso y su evolución.
          </Txt>
        </Card>
      ) : (
        <>
          <Txt variant="subhead" tone="secondary">
            Toca un ejercicio para ver su evolución.
          </Txt>
          <Section title={`Tus ejercicios (${overviews.length})`}>
            {overviews.map((o) => (
              <Row
                key={o.exercise.id}
                title={o.exercise.name}
                subtitle={`${o.sessions} ${o.sessions === 1 ? "sesión" : "sesiones"} · último ${dayLabel(o.lastDate)}`}
                value={weightText(o.bestWeight, o.bestUnit)}
                onPress={() => select(o.exercise)}
              />
            ))}
          </Section>
        </>
      )}
    </Screen>
  );
}

function ScreenLoadingInline() {
  return (
    <Card>
      <Txt variant="subhead" tone="secondary">
        Cargando…
      </Txt>
    </Card>
  );
}
