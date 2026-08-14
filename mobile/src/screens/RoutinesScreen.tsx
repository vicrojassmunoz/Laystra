import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchExercises } from "../api/exercises";
import { createRoutine, deleteRoutine, fetchRoutines, updateRoutine } from "../api/routines";
import { Exercise } from "../types/exercise";
import { Routine, RoutineExercise, RoutineExerciseCreate } from "../types/routine";
import { groupBySuperset } from "../utils/superset";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; routines: Routine[]; exercises: Exercise[] };

// supersetGroup: null = fila suelta; mismo entero (local a este formulario,
// no es un id del backend) = misma super-serie. Ver comentario en
// confirmSuperset/removeRow sobre cómo se asignan/limpian estos ids.
type DraftRow = {
  id: number;
  exerciseId: number | null;
  sets: string;
  supersetGroup: number | null;
};

function makeEmptyRow(id: number): DraftRow {
  return { id, exerciseId: null, sets: "", supersetGroup: null };
}

export default function RoutinesScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const [state, setState] = useState<State>({ status: "loading" });
  const hasDataRef = useRef(false);

  const [name, setName] = useState("");
  const nextRowIdRef = useRef(1);
  const [rows, setRows] = useState<DraftRow[]>([makeEmptyRow(0)]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pickerRowId, setPickerRowId] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  // Contador de ids de bloque de super-serie, local a este formulario (no es
  // un id del backend -- el backend solo exige que el mismo entero se repita
  // entre los ejercicios de un mismo bloque dentro de esta rutina).
  const nextGroupIdRef = useRef(1);
  const [supersetPickerVisible, setSupersetPickerVisible] = useState(false);
  const [supersetSelection, setSupersetSelection] = useState<number[]>([]);

  // null = formulario en modo "Nueva rutina"; si tiene un id, el formulario
  // está editando esa rutina existente (PUT en vez de POST al guardar).
  const [editingId, setEditingId] = useState<number | null>(null);
  // Error de acciones sobre la lista (borrar), separado de formError porque
  // no está atado al formulario de creación/edición.
  const [actionError, setActionError] = useState<string | null>(null);

  // El formulario puede quedar más alto que la pantalla; cuando el teclado
  // aparece, el "Guardar rutina" (al final) queda tapado si no se hace scroll.
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  const load = useCallback(() => {
    if (!hasDataRef.current) {
      setState({ status: "loading" });
    }

    Promise.all([fetchRoutines(), fetchExercises()])
      .then(([routines, exercises]) => {
        hasDataRef.current = true;
        setState({ status: "ready", routines, exercises });
      })
      .catch((error: Error) => {
        if (!hasDataRef.current) {
          setState({ status: "error", message: error.message });
        }
      });
  }, []);

  // Corre cada vez que la pestaña "Rutinas" gana foco (no solo al montar), para
  // que una rutina creada aquí y luego una vuelta desde otra pestaña se refleje.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function updateRow(id: number, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const id = nextRowIdRef.current++;
    setRows((prev) => [...prev, makeEmptyRow(id)]);
  }

  // Si la fila borrada pertenecía a un bloque de super-serie, y solo queda 1
  // miembro de ese bloque tras borrarla, ese miembro se desagrupa solo
  // (supersetGroup: null) -- un bloque de 1 no tiene sentido y el backend lo
  // rechazaría igualmente.
  function removeRow(id: number) {
    setRows((prev) => {
      const removed = prev.find((row) => row.id === id);
      let next = prev.filter((row) => row.id !== id);

      if (removed?.supersetGroup != null) {
        const remaining = next.filter((row) => row.supersetGroup === removed.supersetGroup);
        if (remaining.length === 1) {
          next = next.map((row) =>
            row.id === remaining[0].id ? { ...row, supersetGroup: null } : row
          );
        }
      }

      return next;
    });
  }

  // Quita el bloque entero de una vez (todas sus filas). Si eso deja el
  // formulario sin ninguna fila, se repone una fila vacía -- el formulario
  // siempre debe tener al menos una.
  function removeGroup(groupId: number) {
    setRows((prev) => {
      const next = prev.filter((row) => row.supersetGroup !== groupId);
      return next.length > 0 ? next : [makeEmptyRow(nextRowIdRef.current++)];
    });
  }

  function selectExercise(rowId: number, exerciseId: number) {
    updateRow(rowId, { exerciseId });
    setPickerRowId(null);
  }

  function openSupersetPicker() {
    setSupersetSelection([]);
    setSupersetPickerVisible(true);
  }

  function toggleSupersetExercise(id: number) {
    setSupersetSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // Añade N filas nuevas (una por ejercicio elegido), todas con el mismo
  // supersetGroup nuevo. Cada una conserva su propio input de "Sets" -- no
  // se fuerza que sean iguales entre miembros del bloque.
  function confirmSuperset() {
    if (supersetSelection.length < 2) {
      return;
    }

    const groupId = nextGroupIdRef.current++;
    const newRows: DraftRow[] = supersetSelection.map((exerciseId) => ({
      id: nextRowIdRef.current++,
      exerciseId,
      sets: "",
      supersetGroup: groupId,
    }));

    setRows((prev) => [...prev, ...newRows]);
    setSupersetPickerVisible(false);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    nextRowIdRef.current = 1;
    nextGroupIdRef.current = 1;
    setRows([makeEmptyRow(0)]);
    setFormError(null);
  }

  // Precarga el formulario con los datos de una rutina existente y lo pone en
  // modo edición. El formulario vive al final del ScrollView (debajo de la
  // lista), así que hacemos scrollToEnd para que el usuario vea el cambio
  // aunque tocara "Editar" en una tarjeta muy arriba.
  function startEdit(routine: Routine) {
    const sortedExercises = routine.exercises.slice().sort((a, b) => a.order - b.order);
    const newRows: DraftRow[] = sortedExercises.map((re, index) => ({
      id: index,
      exerciseId: re.exercise_id,
      sets: String(re.target_sets),
      supersetGroup: re.superset_group,
    }));

    nextRowIdRef.current = newRows.length;
    // Los ids de grupo que trae la rutina (superset_group) se reusan tal
    // cual como ids locales -- solo hay que asegurar que el próximo grupo
    // que se cree en este formulario (con "+ Super-serie") no choque con
    // ninguno ya cargado.
    const maxGroup = sortedExercises.reduce(
      (max, re) => (re.superset_group != null ? Math.max(max, re.superset_group) : max),
      0
    );
    nextGroupIdRef.current = maxGroup + 1;
    setEditingId(routine.id);
    setName(routine.name);
    setRows(newRows.length > 0 ? newRows : [makeEmptyRow(0)]);
    setFormError(null);
    scrollRef.current?.scrollToEnd({ animated: true });
  }

  function confirmDelete(routine: Routine) {
    Alert.alert("¿Borrar rutina?", `Se borrará "${routine.name}" permanentemente.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: () => handleDelete(routine.id),
      },
    ]);
  }

  async function handleDelete(id: number) {
    setActionError(null);
    try {
      await deleteRoutine(id);
      if (editingId === id) {
        resetForm();
      }
      load();
    } catch (error) {
      setActionError((error as Error).message);
    }
  }

  async function handleSave() {
    setFormError(null);

    if (!name.trim()) {
      setFormError("Ponle un nombre a la rutina.");
      return;
    }

    const exercises: RoutineExerciseCreate[] = [];
    let order = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const isUntouched = row.exerciseId === null && !row.sets.trim();
      if (isUntouched) {
        // Fila añadida pero nunca rellenada: se ignora en silencio, no es un error.
        continue;
      }

      if (row.exerciseId === null) {
        setFormError(`Falta elegir ejercicio en la fila ${i + 1}.`);
        return;
      }

      const sets = Number(row.sets);
      if (!Number.isInteger(sets) || sets <= 0) {
        setFormError(`Sets debe ser un número entero mayor que 0 en la fila ${i + 1}.`);
        return;
      }

      exercises.push({
        exercise_id: row.exerciseId,
        target_sets: sets,
        order: order++,
        superset_group: row.supersetGroup,
      });
    }

    if (exercises.length === 0) {
      setFormError("Añade al menos un ejercicio.");
      return;
    }

    setSaving(true);
    try {
      const payload = { name: name.trim(), exercises };
      if (editingId !== null) {
        await updateRoutine(editingId, payload);
      } else {
        await createRoutine(payload);
      }
      resetForm();
      load();
    } catch (error) {
      setFormError((error as Error).message);
    } finally {
      setSaving(false);
    }
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

  const { routines, exercises } = state;

  // Fila del formulario (picker de ejercicio + input de sets + "Quitar"),
  // reusada tanto para filas sueltas como para cada miembro de un bloque de
  // super-serie -- el JSX es idéntico en los dos casos, solo cambia si va
  // envuelta en el contenedor de bloque o no.
  function renderDraftRow(row: DraftRow) {
    const selectedExercise = exercises.find((e) => e.id === row.exerciseId);
    return (
      <View key={row.id} style={styles.row}>
        <TouchableOpacity style={styles.pickerButton} onPress={() => setPickerRowId(row.id)}>
          <Text style={selectedExercise ? styles.pickerButtonText : styles.pickerPlaceholderText}>
            {selectedExercise?.name ?? "Selecciona un ejercicio"}
          </Text>
        </TouchableOpacity>

        <TextInput
          style={styles.numberInput}
          placeholder="Sets"
          keyboardType="number-pad"
          value={row.sets}
          onChangeText={(text) => updateRow(row.id, { sets: text })}
        />

        {rows.length > 1 && (
          <Button title="Quitar" color="#b00020" onPress={() => removeRow(row.id)} />
        )}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={tabBarHeight}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Rutinas</Text>

          {routines.length === 0 && (
            <Text style={styles.emptyText}>Todavía no hay rutinas.</Text>
          )}

          {actionError && <Text style={styles.errorDetail}>{actionError}</Text>}

          {routines.map((routine) => (
            <View key={routine.id} style={styles.card}>
              <Text style={styles.routineName}>{routine.name}</Text>
              {groupBySuperset(
                routine.exercises.slice().sort((a, b) => a.order - b.order),
                (re: RoutineExercise) => re.superset_group
              ).map((entry) => {
                if (entry.type === "single") {
                  const re = entry.item;
                  const exercise = exercises.find((e) => e.id === re.exercise_id);
                  return (
                    <Text key={re.id} style={styles.exerciseLine}>
                      {exercise?.name ?? `Ejercicio #${re.exercise_id}`} — {re.target_sets} series
                    </Text>
                  );
                }

                return (
                  <View key={`group-${entry.groupId}`} style={styles.supersetGroupBoxReadOnly}>
                    <Text style={styles.supersetGroupLabel}>Super-serie</Text>
                    {entry.items.map((re) => {
                      const exercise = exercises.find((e) => e.id === re.exercise_id);
                      return (
                        <Text key={re.id} style={styles.exerciseLine}>
                          {exercise?.name ?? `Ejercicio #${re.exercise_id}`} — {re.target_sets} series
                        </Text>
                      );
                    })}
                  </View>
                );
              })}
              <View style={styles.cardActions}>
                <Button title="Editar" onPress={() => startEdit(routine)} />
                <Button title="Borrar" color="#b00020" onPress={() => confirmDelete(routine)} />
              </View>
            </View>
          ))}

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {editingId !== null ? "Editar rutina" : "Nueva rutina"}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Nombre de la rutina"
              value={name}
              onChangeText={setName}
            />

            {groupBySuperset(rows, (row) => row.supersetGroup).map((entry) => {
              if (entry.type === "single") {
                return renderDraftRow(entry.item);
              }

              return (
                <View key={`group-${entry.groupId}`} style={styles.supersetGroupBox}>
                  <View style={styles.supersetGroupHeader}>
                    <Text style={styles.supersetGroupLabel}>Super-serie</Text>
                    <Button
                      title="Quitar bloque"
                      color="#b00020"
                      onPress={() => removeGroup(entry.groupId)}
                    />
                  </View>
                  {entry.items.map((row) => renderDraftRow(row))}
                </View>
              );
            })}

            <View style={styles.formButtonsRow}>
              <Button title="Añadir ejercicio" onPress={addRow} />
              <Button title="+ Super-serie" onPress={openSupersetPicker} />
            </View>

            {formError && <Text style={styles.errorDetail}>{formError}</Text>}

            <View style={styles.saveButton}>
              <Button
                title={
                  saving ? "Guardando..." : editingId !== null ? "Guardar cambios" : "Guardar rutina"
                }
                onPress={handleSave}
                disabled={saving}
              />
            </View>

            {editingId !== null && (
              <View style={styles.cancelEditButton}>
                <Button title="Cancelar edición" color="#666" onPress={resetForm} disabled={saving} />
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={pickerRowId !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Elige un ejercicio</Text>

            <ScrollView>
              {exercises.map((exercise) => (
                <TouchableOpacity
                  key={exercise.id}
                  style={styles.option}
                  onPress={() => pickerRowId !== null && selectExercise(pickerRowId, exercise.id)}
                >
                  <Text style={styles.optionText}>{exercise.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setPickerRowId(null)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Picker de multi-selección para armar un bloque de super-serie --
          distinto del modal de arriba, que elige un solo ejercicio para una
          fila concreta. Mismo estilo visual (sin cerrar al tocar fuera),
          consistente con el resto de esta pantalla. */}
      <Modal visible={supersetPickerVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Elige ejercicios para la super-serie</Text>

            <ScrollView>
              {exercises.map((exercise) => {
                const selected = supersetSelection.includes(exercise.id);
                return (
                  <TouchableOpacity
                    key={exercise.id}
                    style={styles.option}
                    onPress={() => toggleSupersetExercise(exercise.id)}
                  >
                    <Text style={selected ? styles.optionTextSelected : styles.optionText}>
                      {selected ? "✓ " : ""}
                      {exercise.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.supersetCancelButton}
                onPress={() => setSupersetPickerVisible(false)}
              >
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.doneButton}
                onPress={confirmSuperset}
                disabled={supersetSelection.length < 2}
              >
                <Text
                  style={supersetSelection.length < 2 ? styles.doneTextDisabled : styles.doneText}
                >
                  Listo ({supersetSelection.length})
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#f4f4f4",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  routineName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  exerciseLine: {
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
  // Contenedor visual para un bloque de super-serie dentro de la lista de
  // rutinas ya creadas (modo solo lectura) -- mismo espíritu que
  // supersetGroupBox del formulario, pero sin acciones.
  supersetGroupBoxReadOnly: {
    borderWidth: 1,
    borderColor: "#8ab4f8",
    borderRadius: 6,
    padding: 8,
    marginVertical: 4,
  },
  supersetGroupBox: {
    borderWidth: 1,
    borderColor: "#8ab4f8",
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  supersetGroupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  supersetGroupLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3b5bdb",
    textTransform: "uppercase",
  },
  formButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  formCard: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  row: {
    marginBottom: 8,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 10,
    marginBottom: 4,
  },
  pickerButtonText: {
    fontSize: 16,
    color: "#000",
  },
  pickerPlaceholderText: {
    fontSize: 16,
    color: "#999",
  },
  numberInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    marginBottom: 4,
  },
  saveButton: {
    marginTop: 12,
  },
  cancelEditButton: {
    marginTop: 8,
  },
  errorDetail: {
    fontSize: 14,
    color: "#b00020",
    marginTop: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: "70%",
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
    borderBottomColor: "#eee",
  },
  optionText: {
    fontSize: 16,
    textAlign: "center",
  },
  optionTextSelected: {
    fontSize: 16,
    textAlign: "center",
    fontWeight: "600",
    color: "#1b8a1b",
  },
  cancelButton: {
    paddingVertical: 14,
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
    textAlign: "center",
    color: "#b00020",
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  supersetCancelButton: {
    flex: 1,
    paddingVertical: 14,
  },
  doneButton: {
    flex: 1,
    paddingVertical: 14,
  },
  doneText: {
    fontSize: 16,
    textAlign: "center",
    color: "#1b8a1b",
    fontWeight: "600",
  },
  doneTextDisabled: {
    fontSize: 16,
    textAlign: "center",
    color: "#aaa",
    fontWeight: "600",
  },
});
