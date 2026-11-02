import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchExercises } from "../api/exercises";
import { fetchRoutines } from "../api/routines";
import { todayIsoDate } from "../api/today";
import { deleteWorkout, exportWorkoutsCsv, fetchWorkouts, updateWorkout } from "../api/workouts";
import ExercisePickerList from "../components/ExercisePickerList";
import SupersetBlock, { SetDraft } from "../components/SupersetBlock";
import SetRow from "../components/SetRow";
import Button from "../components/ui/Button";
import { Card, SectionHeader } from "../components/ui/Card";
import Icon from "../components/ui/Icon";
import { ScreenError, ScreenLoading } from "../components/ui/Screen";
import TextField from "../components/ui/TextField";
import Txt from "../components/ui/Txt";
import { WeightUnitChips } from "../components/WeightUnitChips";
import { Exercise, WeightUnit } from "../types/exercise";
import { Routine } from "../types/routine";
import { Workout, WorkoutSet, WorkoutSetCreate } from "../types/workout";
import { parseDecimalInput } from "../utils/number";
import { secondaryHint } from "../utils/exercisePicker";
import { groupBySuperset, validSupersetGroups } from "../utils/superset";
import { convertWeight } from "../utils/weightUnit";
import { showAlert } from "../utils/alert";
import { shareCsv } from "../utils/shareCsv";
import {
  dayLabel,
  formatVolume,
  monthLabel,
  summarizeByExercise,
  workoutStats,
} from "../utils/workoutSummary";
import { Text } from "../components/ui/compat";
import { makeStyles, space, useTheme } from "../theme/theme";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; workouts: Workout[]; exercises: Exercise[]; routines: Routine[] };

// SetDraft (id + weight/reps como string) viene de SupersetBlock -- mismo
// tipo que usa TodayScreen, así se reusa uno solo en vez de declararlo dos
// veces con nombres distintos.
type EditSetDraft = SetDraft;

// supersetGroup: null = tramo suelto; si no, todas las series de este grupo
// pertenecían al mismo bloque de super-serie en el workout original.
type EditExerciseGroup = {
  exerciseId: number;
  supersetGroup: number | null;
  unit: WeightUnit;
  sets: EditSetDraft[];
};

// Variante de groupSetsByExercise para el modo edición: en vez de texto ya
// formateado, devuelve filas editables (weight/reps como string, igual que
// SetDraft en TodayScreen) agrupadas por ejercicio. Se puede añadir un
// ejercicio que el workout no tenía (picker + create, ver addExerciseToEdit).
// Sigue agrupando por tramos contiguos de mismo exercise_id (un workout con
// una super-serie A-B-A genera dos grupos de A, no uno) -- lo nuevo es que
// cada grupo también recuerda su superset_group, para poder re-agruparlos
// visualmente en bloques de rondas intercaladas (ver groupBySuperset en el
// render).
function buildEditGroups(
  sets: WorkoutSet[],
  nextId: () => number,
  exerciseById: Map<number, Exercise>
): EditExerciseGroup[] {
  const groups: EditExerciseGroup[] = [];

  for (const set of sets) {
    const draft: EditSetDraft = {
      id: nextId(),
      weight: String(set.weight),
      reps: String(set.reps),
    };
    const unit = (set.unit ?? exerciseById.get(set.exercise_id)?.unit ?? "kg") as WeightUnit;

    const last = groups[groups.length - 1];
    if (last && last.exerciseId === set.exercise_id && last.supersetGroup === set.superset_group) {
      last.sets.push(draft);
    } else {
      groups.push({
        exerciseId: set.exercise_id,
        supersetGroup: set.superset_group,
        unit,
        sets: [draft],
      });
    }
  }

  return groups;
}

export default function HistorialScreen() {
  const styles = useStyles();
  const [state, setState] = useState<State>({ status: "loading" });
  const hasDataRef = useRef(false);

  // Solo una tarjeta puede estar en modo edición a la vez -- null significa que
  // todas las tarjetas están en modo lectura.
  const [editingWorkoutId, setEditingWorkoutId] = useState<number | null>(null);
  const [editRows, setEditRows] = useState<EditExerciseGroup[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  // Sensaciones del entreno en edición (ROADMAP #6). Un PUT sin `notes` las borra,
  // así que se reenvían siempre, también cuando no se tocan.
  const [editNotes, setEditNotes] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  // Error de borrado, separado de editError porque no está atado al formulario
  // de edición (puede pasar sobre cualquier tarjeta, esté o no en modo edición).
  const [actionError, setActionError] = useState<string | null>(null);
  // Evita doble-tap mientras la petición de borrado está en curso.
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<number | null>(null);
  const [addExercisePickerVisible, setAddExercisePickerVisible] = useState(false);
  const [addExerciseQuery, setAddExerciseQuery] = useState("");
  const [exporting, setExporting] = useState(false);
  // Entrenos desplegados (ids). Vacío = todos recogidos; el que se edita siempre va abierto.
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const { colors } = useTheme();

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }
  // Contador compartido para ids de fila de serie en el formulario de edición,
  // igual que nextSetIdRef en TodayScreen -- da a cada fila una key estable.
  const nextEditIdRef = useRef(1);
  function nextEditId(): number {
    return nextEditIdRef.current++;
  }

  const load = useCallback(() => {
    if (!hasDataRef.current) {
      setState({ status: "loading" });
    }

    Promise.all([fetchWorkouts(), fetchExercises(), fetchRoutines()])
      .then(([workouts, exercises, routines]) => {
        hasDataRef.current = true;
        setState({ status: "ready", workouts, exercises, routines });
        // Una recarga exitosa deja la pantalla al día con el backend -- si había
        // un actionError de un borrado fallido anterior, ya no aplica.
        setActionError(null);
      })
      .catch((error: Error) => {
        if (!hasDataRef.current) {
          setState({ status: "error", message: error.message });
        }
      });
  }, []);

  // Corre cada vez que la pestaña "Historial" gana foco (no solo al montar),
  // para reflejar entrenos guardados desde la pestaña "Hoy".
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function startEdit(workout: Workout) {
    const exerciseById =
      state.status === "ready"
        ? new Map(state.exercises.map((exercise) => [exercise.id, exercise]))
        : new Map<number, Exercise>();
    setEditingWorkoutId(workout.id);
    setEditRows(buildEditGroups(workout.sets, nextEditId, exerciseById));
    setEditNotes(workout.notes ?? "");
    setEditError(null);
    setAddExercisePickerVisible(false);
  }

  function cancelEdit() {
    setEditingWorkoutId(null);
    setEditRows([]);
    setEditNotes("");
    setEditError(null);
    setAddExercisePickerVisible(false);
  }

  function appendCreatedExercise(exercise: Exercise) {
    setState((prev) => {
      if (prev.status !== "ready") {
        return prev;
      }
      if (prev.exercises.some((e) => e.id === exercise.id)) {
        return prev;
      }
      return { ...prev, exercises: [...prev.exercises, exercise] };
    });
  }

  function replaceUpdatedExercise(exercise: Exercise) {
    setState((prev) =>
      prev.status === "ready"
        ? {
            ...prev,
            exercises: prev.exercises.map((item) =>
              item.id === exercise.id ? exercise : item
            ),
          }
        : prev
    );

    fetchWorkouts()
      .then((workouts) => {
        setState((prev) =>
          prev.status === "ready" ? { ...prev, workouts } : prev
        );
      })
      .catch((error: Error) => {
        setActionError(error.message);
      });
  }

  function addExerciseToEdit(exercise: Exercise) {
    appendCreatedExercise(exercise);
    setEditRows((prev) => [
      ...prev,
      {
        exerciseId: exercise.id,
        supersetGroup: null,
        unit: exercise.unit,
        sets: [{ id: nextEditId(), weight: "", reps: "" }],
      },
    ]);
    setAddExercisePickerVisible(false);
    setAddExerciseQuery("");
  }

  async function handleExportCsv() {
    setExporting(true);
    setActionError(null);
    try {
      await shareCsv(await exportWorkoutsCsv(), "laystra-workouts.csv", "Exportar entrenos");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo exportar el CSV.");
    } finally {
      setExporting(false);
    }
  }

  function confirmDelete(workout: Workout, routineName: string) {
    showAlert(
      "¿Borrar entreno?",
      `Se borrará el entreno de "${routineName}" del ${workout.date} permanentemente.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: () => handleDelete(workout.id),
        },
      ]
    );
  }

  function handleDelete(id: number) {
    setActionError(null);
    setDeletingWorkoutId(id);
    deleteWorkout(id)
      .then(() => {
        if (editingWorkoutId === id) {
          cancelEdit();
        }
        load();
      })
      .catch((error: Error) => {
        setActionError(error.message);
        // Si el borrado falló porque el workout ya no existe (p.ej. 404, borrado
        // desde otro sitio), la tarjeta se queda "fantasma" en pantalla y cada
        // reintento repite el mismo error hasta cambiar de pestaña -- se recarga
        // la lista para reconciliar la UI con el estado real del backend.
        load();
      })
      .finally(() => {
        setDeletingWorkoutId(null);
      });
  }

  function updateEditSet(groupIndex: number, setIndex: number, patch: Partial<EditSetDraft>) {
    setEditRows((prev) =>
      prev.map((group, i) =>
        i === groupIndex
          ? {
              ...group,
              sets: group.sets.map((s, j) => (j === setIndex ? { ...s, ...patch } : s)),
            }
          : group
      )
    );
  }

  function addEditSet(groupIndex: number) {
    setEditRows((prev) =>
      prev.map((group, i) => {
        if (i !== groupIndex) {
          return group;
        }
        // La fila nueva hereda el peso de la última serie existente, igual que
        // en TodayScreen -- el mismo ejercicio suele pesar lo mismo en todas
        // sus series.
        const lastWeight = group.sets.length > 0 ? group.sets[group.sets.length - 1].weight : "";
        return {
          ...group,
          sets: [...group.sets, { id: nextEditId(), weight: lastWeight, reps: "" }],
        };
      })
    );
  }

  function changeEditUnit(groupIndex: number, nextUnit: WeightUnit) {
    setEditRows((prev) =>
      prev.map((group, i) => {
        if (i !== groupIndex) {
          return group;
        }
        const fromUnit = group.unit;
        if (fromUnit === nextUnit) {
          return group;
        }
        return {
          ...group,
          unit: nextUnit,
          sets:
            nextUnit === "bw" || fromUnit === "bw"
              ? group.sets
              : group.sets.map((set) => {
                  const parsed = parseDecimalInput(set.weight);
                  if (parsed === null) {
                    return set;
                  }
                  return {
                    ...set,
                    weight: String(convertWeight(parsed, fromUnit, nextUnit)),
                  };
                }),
        };
      })
    );
  }

  function removeEditSet(groupIndex: number, setIndex: number) {
    setEditRows((prev) =>
      prev.map((group, i) =>
        i === groupIndex ? { ...group, sets: group.sets.filter((_, j) => j !== setIndex) } : group
      )
    );
  }

  // Variantes de addEditSet/removeEditSet para un bloque de super-serie:
  // añaden/quitan la misma "ronda" (posición de serie) en todos los grupos
  // del bloque a la vez -- groupIndices son las posiciones dentro de
  // editRows de los miembros de ese bloque. Mismo patrón que
  // addRoundToGroup/removeRoundFromGroup en TodayScreen.
  function addEditRoundToGroup(groupIndices: number[]) {
    for (const index of groupIndices) {
      addEditSet(index);
    }
  }

  function removeEditRoundFromGroup(groupIndices: number[], roundIndex: number) {
    setEditRows((prev) =>
      prev.map((group, i) =>
        groupIndices.includes(i)
          ? { ...group, sets: group.sets.filter((_, j) => j !== roundIndex) }
          : group
      )
    );
  }

  function handleSaveEdit(workout: Workout, exerciseById: Map<number, Exercise>) {
    setEditError(null);

    // Red de seguridad: un bloque puede llegar aquí ya con miembros de
    // distinta longitud (así se guardó el workout originalmente), y "Quitar
    // ronda" (que opera sobre todos los miembros del bloque a la vez) puede
    // dejar a uno con 0 series. Cualquier superset_group que en este momento
    // cubra menos de 2 exercise_id distintos se anula a null en vez de dejar
    // que el backend lo rechace con un 400 -- mismo patrón que en
    // TodayScreen.handleSave.
    const validGroups = validSupersetGroups(
      editRows.map((group) => ({
        exerciseId: group.exerciseId,
        group: group.supersetGroup,
        hasSets: group.sets.length > 0,
      }))
    );

    const sets: WorkoutSetCreate[] = [];
    let order = 0;

    for (const group of editRows) {
      // Un ejercicio puede quedarse sin series si se quitan todas -- se ignora
      // en vez de bloquear el guardado, igual que en TodayScreen.
      if (group.sets.length === 0) {
        continue;
      }

      const exerciseName = exerciseById.get(group.exerciseId)?.name ?? `Ejercicio #${group.exerciseId}`;

      for (let i = 0; i < group.sets.length; i++) {
        const draft = group.sets[i];
        const parsed = parseDecimalInput(draft.weight);
        const weight = group.unit === "bw" ? (parsed ?? 0) : parsed;
        const reps = Number(draft.reps);

        if (group.unit !== "bw" && weight === null) {
          setEditError(`Peso inválido en "${exerciseName}", serie ${i + 1}.`);
          return;
        }

        if (draft.reps.trim() === "" || !Number.isInteger(reps) || reps < 0) {
          setEditError(`Reps inválidas en "${exerciseName}", serie ${i + 1}.`);
          return;
        }

        const supersetGroup = group.supersetGroup;

        sets.push({
          exercise_id: group.exerciseId,
          weight: weight ?? 0,
          reps,
          order: order++,
          unit: group.unit,
          superset_group:
            supersetGroup != null && validGroups.has(supersetGroup) ? supersetGroup : null,
        });
      }
    }

    if (sets.length === 0) {
      setEditError("El entreno debe tener al menos una serie.");
      return;
    }

    setEditSaving(true);
    const trimmedNotes = editNotes.trim();
    updateWorkout(workout.id, {
      date: workout.date,
      routine_id: workout.routine_id,
      notes: trimmedNotes === "" ? null : trimmedNotes,
      sets,
    })
      .then(() => {
        setEditingWorkoutId(null);
        setEditRows([]);
        load();
      })
      .catch((error: Error) => {
        setEditError(error.message);
      })
      .finally(() => {
        setEditSaving(false);
      });
  }

  if (state.status === "loading") {
    return <ScreenLoading />;
  }

  if (state.status === "error") {
    return <ScreenError message={state.message} />;
  }

  const { workouts, exercises, routines } = state;
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const routineById = new Map(routines.map((r) => [r.id, r]));

  // Resumen de los últimos 30 días (fechas ISO se comparan como texto).
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoffIso = `${cutoffDate.getFullYear()}-${String(cutoffDate.getMonth() + 1).padStart(2, "0")}-${String(cutoffDate.getDate()).padStart(2, "0")}`;
  const recent = workouts.filter((w) => w.date >= cutoffIso && w.date <= todayIsoDate());
  const recentVolumeKg = recent.reduce((sum, w) => sum + workoutStats(w).volumeKg, 0);

  // Agrupa por mes (los entrenos ya vienen ordenados de más nuevo a más viejo).
  const months: { key: string; label: string; items: Workout[] }[] = [];
  for (const workout of workouts) {
    const key = workout.date.slice(0, 7);
    const last = months[months.length - 1];
    if (last && last.key === key) {
      last.items.push(workout);
    } else {
      months.push({ key, label: monthLabel(workout.date), items: [workout] });
    }
  }

  const busy = editingWorkoutId !== null || deletingWorkoutId !== null;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {workouts.length === 0 ? (
            <Card>
              <Txt variant="headline">Aún no hay entrenos</Txt>
              <Txt variant="subhead" tone="secondary">
                Cuando guardes tu primera sesión aparecerá aquí, agrupada por mes.
              </Txt>
            </Card>
          ) : (
            <Card>
              <Txt variant="footnote" tone="secondary" weight="600">
                Últimos 30 días
              </Txt>
              <View style={styles.statsRow}>
                <View>
                  <Txt variant="title2" numeric>
                    {recent.length}
                  </Txt>
                  <Txt variant="footnote" tone="secondary">
                    {recent.length === 1 ? "entreno" : "entrenos"}
                  </Txt>
                </View>
                <View>
                  <Txt variant="title2" numeric>
                    {formatVolume(recentVolumeKg)}
                  </Txt>
                  <Txt variant="footnote" tone="secondary">
                    de volumen
                  </Txt>
                </View>
              </View>
            </Card>
          )}

          {actionError ? (
            <Txt variant="subhead" tone="danger">
              {actionError}
            </Txt>
          ) : null}

          {months.map((month) => (
            <View key={month.key} style={styles.monthBlock}>
              <SectionHeader>{month.label}</SectionHeader>

              {month.items.map((workout) => {
                const routineName =
                  workout.routine_id != null
                    ? routineById.get(workout.routine_id)?.name ?? `Rutina #${workout.routine_id}`
                    : "Entreno libre";
                const isEditing = editingWorkoutId === workout.id;
                const isOpen = expandedIds.has(workout.id);
                const stats = workoutStats(workout);

                if (isEditing) {
                  // Edición: una tarjeta por ejercicio / super-serie (mismo formato
                  // que Sesión), sin tarjetas anidadas dentro de la del entreno.
                  return (
                    <View key={workout.id} style={styles.editBlock}>
                      <View style={styles.editHeader}>
                        <Txt variant="headline" style={{ flex: 1 }}>
                          {routineName}
                        </Txt>
                        <Txt variant="subhead" tone="secondary" numeric>
                          {dayLabel(workout.date)}
                        </Txt>
                      </View>

                      {groupBySuperset(
                        editRows.map((group, index) => ({ group, index })),
                        (entry) => entry.group.supersetGroup
                      ).map((entry) => {
                        if (entry.type === "single") {
                          const { group, index: groupIndex } = entry.item;
                          const exercise = exerciseById.get(group.exerciseId);
                          const name = exercise?.name ?? `Ejercicio #${group.exerciseId}`;
                          return (
                            // buildEditGroups agrupa por tramos contiguos del mismo
                            // ejercicio -- un entreno con el mismo ejercicio en dos
                            // tramos separados (ej. superserie A-B-A) genera dos
                            // grupos con el mismo exerciseId, así que hace falta
                            // combinarlo con el índice del tramo para que la key
                            // sea única.
                            <Card key={`${group.exerciseId}-${groupIndex}`}>
                              <Txt variant="headline">{name}</Txt>
                              <WeightUnitChips
                                value={group.unit}
                                onChange={(unit) => changeEditUnit(groupIndex, unit)}
                                disabled={editSaving}
                              />

                              {group.sets.map((setDraft, setIndex) => (
                                <SetRow
                                  key={setDraft.id}
                                  label={`Serie ${setIndex + 1}`}
                                  unit={group.unit}
                                  weight={setDraft.weight}
                                  reps={setDraft.reps}
                                  bodyWeightKg={parseDecimalInput(setDraft.weight)}
                                  editable={!editSaving}
                                  onChangeWeight={(text) =>
                                    updateEditSet(groupIndex, setIndex, { weight: text })
                                  }
                                  onChangeReps={(text) =>
                                    updateEditSet(groupIndex, setIndex, { reps: text })
                                  }
                                  onRemove={() => removeEditSet(groupIndex, setIndex)}
                                />
                              ))}

                              <Button
                                title="Añadir serie"
                                icon="plus"
                                variant="tinted"
                                fullWidth
                                disabled={editSaving}
                                onPress={() => addEditSet(groupIndex)}
                              />
                            </Card>
                          );
                        }

                        const indices = entry.items.map((it) => it.index);
                        const members = entry.items.map((it) => {
                          const exercise = exerciseById.get(it.group.exerciseId);
                          return {
                            key: `${it.group.exerciseId}-${it.index}`,
                            exerciseId: it.group.exerciseId,
                            name: exercise?.name ?? `Ejercicio #${it.group.exerciseId}`,
                            unit: it.group.unit,
                            sets: it.group.sets,
                          };
                        });

                        return (
                          <SupersetBlock
                            key={`group-${entry.groupId}`}
                            members={members}
                            disabled={editSaving}
                            onChangeUnit={(memberIndex, unit) =>
                              changeEditUnit(indices[memberIndex], unit)
                            }
                            onChangeSet={(memberIndex, roundIndex, patch) =>
                              updateEditSet(indices[memberIndex], roundIndex, patch)
                            }
                            onAddRound={() => addEditRoundToGroup(indices)}
                            onRemoveRound={(roundIndex) =>
                              removeEditRoundFromGroup(indices, roundIndex)
                            }
                          />
                        );
                      })}

                      <Card>
                        <Txt variant="headline">Sensaciones</Txt>
                        <TextField
                          multiline
                          placeholder="¿Cómo te sentiste? (opcional)"
                          value={editNotes}
                          editable={!editSaving}
                          maxLength={2000}
                          onChangeText={setEditNotes}
                        />
                      </Card>

                      {editError ? (
                        <Txt variant="subhead" tone="danger" style={{ textAlign: "center" }}>
                          {editError}
                        </Txt>
                      ) : null}

                      <Button
                        title="Añadir ejercicio"
                        icon="plus"
                        variant="tinted"
                        fullWidth
                        disabled={editSaving}
                        onPress={() => {
                          setAddExerciseQuery("");
                          setAddExercisePickerVisible(true);
                        }}
                      />

                      <View style={styles.editActions}>
                        <View style={{ flex: 1 }}>
                          <Button
                            title="Cancelar"
                            variant="tinted"
                            size="large"
                            fullWidth
                            disabled={editSaving}
                            onPress={cancelEdit}
                          />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Button
                            title={editSaving ? "Guardando..." : "Guardar"}
                            variant="filled"
                            size="large"
                            fullWidth
                            disabled={editSaving}
                            onPress={() => handleSaveEdit(workout, exerciseById)}
                          />
                        </View>
                      </View>
                    </View>
                  );
                }

                return (
                  <Card key={workout.id}>
                    <Pressable
                      onPress={() => toggleExpanded(workout.id)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: isOpen }}
                      style={styles.cardHeader}
                    >
                      <View style={{ flex: 1, gap: 2 }}>
                        <Txt variant="headline">{routineName}</Txt>
                        <Txt variant="subhead" tone="secondary" numeric>
                          {dayLabel(workout.date)} · {stats.exercises} ejercicio
                          {stats.exercises === 1 ? "" : "s"}
                        </Txt>
                        <Txt variant="footnote" tone="secondary" numeric>
                          {stats.sets} serie{stats.sets === 1 ? "" : "s"} ·{" "}
                          {formatVolume(stats.volumeKg)} de volumen
                        </Txt>
                      </View>
                      <Icon
                        name={isOpen ? "collapse" : "expand"}
                        size={14}
                        color={colors.labelSecondary}
                      />
                    </Pressable>

                    {workout.notes ? (
                      <View style={styles.notesRow}>
                        <Icon name="note" size={15} color={colors.labelSecondary} />
                        <Txt
                          variant="subhead"
                          tone="secondary"
                          numberOfLines={isOpen ? undefined : 1}
                          style={{ flex: 1 }}
                        >
                          {workout.notes}
                        </Txt>
                      </View>
                    ) : null}

                    {isOpen ? (
                      <>
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

                        <View style={styles.actions}>
                          <Button
                            title="Editar"
                            variant="tinted"
                            size="compact"
                            disabled={busy}
                            onPress={() => startEdit(workout)}
                          />
                          <Button
                            title={deletingWorkoutId === workout.id ? "Borrando..." : "Borrar"}
                            variant="plainDestructive"
                            size="compact"
                            disabled={busy}
                            onPress={() => confirmDelete(workout, routineName)}
                          />
                        </View>
                      </>
                    ) : null}
                  </Card>
                );
              })}
            </View>
          ))}

          {workouts.length > 0 ? (
            <Button
              title={exporting ? "Exportando..." : "Exportar CSV"}
              variant="plain"
              icon="note"
              disabled={exporting}
              onPress={handleExportCsv}
            />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={addExercisePickerVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <KeyboardAvoidingView
            style={styles.avoider}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={0}
          >
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Añadir ejercicio</Text>
              {state.status === "ready" && (
                <ExercisePickerList
                  exercises={state.exercises}
                  query={addExerciseQuery}
                  onQueryChange={setAddExerciseQuery}
                  onCreated={appendCreatedExercise}
                  onUpdated={replaceUpdatedExercise}
                  renderItem={(exercise) => {
                    const hint = secondaryHint(exercise);
                    return (
                      <TouchableOpacity
                        style={styles.option}
                        onPress={() => addExerciseToEdit(exercise)}
                      >
                        <Text style={styles.optionText}>{exercise.name}</Text>
                        {hint && <Text style={styles.optionHint}>{hint}</Text>}
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setAddExercisePickerVisible(false)}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  statsRow: { flexDirection: "row", gap: space.xxxl },
  monthBlock: { gap: space.md },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: space.sm },
  notesRow: { flexDirection: "row", alignItems: "flex-start", gap: space.sm },
  exerciseBlock: {
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
    gap: 2,
  },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm },
  editBlock: { gap: space.md },
  editHeader: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  editActions: { flexDirection: "row", gap: space.md },
  notesBox: {
    marginTop: 8,
  },
  notesLabel: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
  },
  notesInput: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    backgroundColor: colors.surface,
    textAlignVertical: "top",
  },
  notesText: {
    fontSize: 14,
    color: colors.labelSecondary,
    fontStyle: "italic",
    marginTop: 6,
  },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: space.lg,
    paddingBottom: space.xxxl * 2,
    gap: space.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
  },
  exportButton: {
    marginBottom: 16,
  },
  addExerciseButton: {
    marginTop: 8,
  },
  emptyText: {
    fontSize: 16,
    color: colors.labelSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  cardEditing: {
    backgroundColor: colors.tintSoft,
    borderWidth: 1,
    borderColor: colors.tint,
  },
  date: {
    fontSize: 14,
    color: colors.labelSecondary,
  },
  routineName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
  },
  setLine: {
    fontSize: 15,
    color: colors.label,
    marginVertical: 2,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  editGroup: {
    marginTop: 8,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  addSetButton: {
    marginTop: 4,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  setLabel: {
    fontSize: 14,
    color: colors.labelSecondary,
    width: 64,
  },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    backgroundColor: colors.surface,
  },
  repsInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    backgroundColor: colors.surface,
  },
  errorDetail: {
    fontSize: 14,
    color: colors.danger,
    marginTop: 8,
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  avoider: {
    maxHeight: "70%",
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    flexShrink: 1,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  option: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
  },
  optionText: {
    fontSize: 16,
    textAlign: "center",
  },
  optionHint: {
    fontSize: 12,
    color: colors.labelTertiary,
    textAlign: "center",
    marginTop: 2,
  },
  cancelButton: {
    paddingVertical: 14,
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
    textAlign: "center",
    color: colors.danger,
    fontWeight: "600",
  },
}));
