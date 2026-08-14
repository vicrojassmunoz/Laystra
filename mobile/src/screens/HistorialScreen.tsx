import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchExercises } from "../api/exercises";
import { fetchRoutines } from "../api/routines";
import { deleteWorkout, fetchWorkouts, updateWorkout } from "../api/workouts";
import SupersetBlock, { SetDraft } from "../components/SupersetBlock";
import { Exercise } from "../types/exercise";
import { Routine } from "../types/routine";
import { Workout, WorkoutSet, WorkoutSetCreate } from "../types/workout";
import { groupBySuperset, validSupersetGroups } from "../utils/superset";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; workouts: Workout[]; exercises: Exercise[]; routines: Routine[] };

type ExerciseGroup = {
  exerciseId: number;
  name: string;
  entries: string[];
};

// Los sets de un workout ya vienen ordenados por "order" desde el backend, así
// que las series del mismo ejercicio quedan contiguas -- agrupamos por eso en
// vez de repetir el nombre del ejercicio en cada línea.
function groupSetsByExercise(
  sets: WorkoutSet[],
  exerciseById: Map<number, Exercise>
): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];

  for (const set of sets) {
    const exercise = exerciseById.get(set.exercise_id);
    const name = exercise?.name ?? `Ejercicio #${set.exercise_id}`;
    const unit = exercise?.unit ?? "";
    const entry = `${set.weight}${unit} x ${set.reps}`;

    const last = groups[groups.length - 1];
    if (last && last.exerciseId === set.exercise_id) {
      last.entries.push(entry);
    } else {
      groups.push({ exerciseId: set.exercise_id, name, entries: [entry] });
    }
  }

  return groups;
}

// SetDraft (id + weight/reps como string) viene de SupersetBlock -- mismo
// tipo que usa TodayScreen, así se reusa uno solo en vez de declararlo dos
// veces con nombres distintos.
type EditSetDraft = SetDraft;

// supersetGroup: null = tramo suelto; si no, todas las series de este grupo
// pertenecían al mismo bloque de super-serie en el workout original.
type EditExerciseGroup = {
  exerciseId: number;
  supersetGroup: number | null;
  sets: EditSetDraft[];
};

// Variante de groupSetsByExercise para el modo edición: en vez de texto ya
// formateado, devuelve filas editables (weight/reps como string, igual que
// SetDraft en TodayScreen) agrupadas por ejercicio. No se permite añadir un
// ejercicio nuevo al workout aquí -- solo editar/añadir/quitar series de los
// que ya tenía, así que no hace falta guardar más que el exerciseId por grupo.
// Sigue agrupando por tramos contiguos de mismo exercise_id (un workout con
// una super-serie A-B-A genera dos grupos de A, no uno) -- lo nuevo es que
// cada grupo también recuerda su superset_group, para poder re-agruparlos
// visualmente en bloques de rondas intercaladas (ver groupBySuperset en el
// render).
function buildEditGroups(sets: WorkoutSet[], nextId: () => number): EditExerciseGroup[] {
  const groups: EditExerciseGroup[] = [];

  for (const set of sets) {
    const draft: EditSetDraft = {
      id: nextId(),
      weight: String(set.weight),
      reps: String(set.reps),
    };

    const last = groups[groups.length - 1];
    if (last && last.exerciseId === set.exercise_id && last.supersetGroup === set.superset_group) {
      last.sets.push(draft);
    } else {
      groups.push({ exerciseId: set.exercise_id, supersetGroup: set.superset_group, sets: [draft] });
    }
  }

  return groups;
}

export default function HistorialScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const [state, setState] = useState<State>({ status: "loading" });
  const hasDataRef = useRef(false);

  // Solo una tarjeta puede estar en modo edición a la vez -- null significa que
  // todas las tarjetas están en modo lectura.
  const [editingWorkoutId, setEditingWorkoutId] = useState<number | null>(null);
  const [editRows, setEditRows] = useState<EditExerciseGroup[]>([]);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  // Error de borrado, separado de editError porque no está atado al formulario
  // de edición (puede pasar sobre cualquier tarjeta, esté o no en modo edición).
  const [actionError, setActionError] = useState<string | null>(null);
  // Evita doble-tap mientras la petición de borrado está en curso.
  const [deletingWorkoutId, setDeletingWorkoutId] = useState<number | null>(null);
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
    setEditingWorkoutId(workout.id);
    setEditRows(buildEditGroups(workout.sets, nextEditId));
    setEditError(null);
  }

  function cancelEdit() {
    setEditingWorkoutId(null);
    setEditRows([]);
    setEditError(null);
  }

  function confirmDelete(workout: Workout, routineName: string) {
    Alert.alert(
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
        // Mismo teclado decimal-pad, mismo problema de coma decimal en locale
        // español que en TodayScreen.
        const weightRaw = draft.weight.trim().replace(",", ".");
        const weight = Number(weightRaw);
        const reps = Number(draft.reps);

        if (weightRaw === "" || Number.isNaN(weight) || weight < 0) {
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
          weight,
          reps,
          order: order++,
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
    updateWorkout(workout.id, { date: workout.date, routine_id: workout.routine_id, sets })
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

  const { workouts, exercises, routines } = state;
  const exerciseById = new Map(exercises.map((e) => [e.id, e]));
  const routineById = new Map(routines.map((r) => [r.id, r]));

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={tabBarHeight}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Historial</Text>

          {workouts.length === 0 && (
            <Text style={styles.emptyText}>Aún no has logueado ningún entreno.</Text>
          )}

          {actionError && <Text style={styles.errorDetail}>{actionError}</Text>}

          {workouts.map((workout) => {
            const routineName =
              workout.routine_id != null
                ? routineById.get(workout.routine_id)?.name ?? `Rutina #${workout.routine_id}`
                : "Entreno libre";

            const isEditing = editingWorkoutId === workout.id;

            return (
              <View
                key={workout.id}
                style={[styles.card, isEditing && styles.cardEditing]}
              >
                <Text style={styles.date}>{workout.date}</Text>
                <Text style={styles.routineName}>{routineName}</Text>

                {isEditing ? (
                  <>
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
                          <View key={`${group.exerciseId}-${groupIndex}`} style={styles.editGroup}>
                            <Text style={styles.exerciseName}>{name}</Text>

                            {group.sets.map((setDraft, setIndex) => (
                              <View key={setDraft.id} style={styles.setRow}>
                                <Text style={styles.setLabel}>Serie {setIndex + 1}</Text>
                                <TextInput
                                  style={styles.weightInput}
                                  placeholder={exercise?.unit}
                                  keyboardType="decimal-pad"
                                  value={setDraft.weight}
                                  editable={!editSaving}
                                  onChangeText={(text) =>
                                    updateEditSet(groupIndex, setIndex, { weight: text })
                                  }
                                />
                                <TextInput
                                  style={styles.repsInput}
                                  placeholder="reps"
                                  keyboardType="number-pad"
                                  value={setDraft.reps}
                                  editable={!editSaving}
                                  onChangeText={(text) =>
                                    updateEditSet(groupIndex, setIndex, { reps: text })
                                  }
                                />
                                <Button
                                  title="Quitar"
                                  color="#b00020"
                                  onPress={() => removeEditSet(groupIndex, setIndex)}
                                  disabled={editSaving}
                                />
                              </View>
                            ))}

                            <View style={styles.addSetButton}>
                              <Button
                                title="+ añadir serie"
                                onPress={() => addEditSet(groupIndex)}
                                disabled={editSaving}
                              />
                            </View>
                          </View>
                        );
                      }

                      const indices = entry.items.map((it) => it.index);
                      const members = entry.items.map((it) => {
                        const exercise = exerciseById.get(it.group.exerciseId);
                        return {
                          key: `${it.group.exerciseId}-${it.index}`,
                          name: exercise?.name ?? `Ejercicio #${it.group.exerciseId}`,
                          unit: exercise?.unit ?? "",
                          sets: it.group.sets,
                        };
                      });

                      return (
                        <SupersetBlock
                          key={`group-${entry.groupId}`}
                          members={members}
                          disabled={editSaving}
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

                    {editError && <Text style={styles.errorDetail}>{editError}</Text>}

                    <View style={styles.cardActions}>
                      <Button title="Cancelar" color="#666" onPress={cancelEdit} disabled={editSaving} />
                      <Button
                        title={editSaving ? "Guardando..." : "Guardar cambios"}
                        onPress={() => handleSaveEdit(workout, exerciseById)}
                        disabled={editSaving}
                      />
                    </View>
                  </>
                ) : (
                  <>
                    {groupSetsByExercise(workout.sets, exerciseById).map((group, index) => (
                      <Text key={`${group.exerciseId}-${index}`} style={styles.setLine}>
                        {group.name}: {group.entries.join(", ")}
                      </Text>
                    ))}

                    <View style={styles.cardActions}>
                      <Button
                        title="Editar"
                        onPress={() => startEdit(workout)}
                        disabled={editingWorkoutId !== null || deletingWorkoutId !== null}
                      />
                      <Button
                        title={deletingWorkoutId === workout.id ? "Borrando..." : "Borrar"}
                        color="#b00020"
                        onPress={() => confirmDelete(workout, routineName)}
                        disabled={editingWorkoutId !== null || deletingWorkoutId !== null}
                      />
                    </View>
                  </>
                )}
              </View>
            );
          })}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: "#555",
  },
  card: {
    backgroundColor: "#f4f4f4",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  cardEditing: {
    backgroundColor: "#eef4ff",
    borderWidth: 1,
    borderColor: "#8ab4f8",
  },
  date: {
    fontSize: 14,
    color: "#555",
  },
  routineName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 6,
  },
  setLine: {
    fontSize: 15,
    color: "#333",
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
    color: "#555",
    width: 64,
  },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  repsInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  errorDetail: {
    fontSize: 14,
    color: "#b00020",
    marginTop: 8,
    textAlign: "center",
  },
});
