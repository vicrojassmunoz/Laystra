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
import { Routine, RoutineExerciseCreate } from "../types/routine";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; routines: Routine[]; exercises: Exercise[] };

type DraftRow = {
  id: number;
  exerciseId: number | null;
  sets: string;
  reps: string;
};

function makeEmptyRow(id: number): DraftRow {
  return { id, exerciseId: null, sets: "", reps: "" };
}

export default function RoutinesScreen() {
  const [state, setState] = useState<State>({ status: "loading" });
  const hasDataRef = useRef(false);

  const [name, setName] = useState("");
  const nextRowIdRef = useRef(1);
  const [rows, setRows] = useState<DraftRow[]>([makeEmptyRow(0)]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pickerRowId, setPickerRowId] = useState<number | null>(null);
  const scrollRef = useRef<ScrollView>(null);

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

  function removeRow(id: number) {
    setRows((prev) => prev.filter((row) => row.id !== id));
  }

  function selectExercise(rowId: number, exerciseId: number) {
    updateRow(rowId, { exerciseId });
    setPickerRowId(null);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    nextRowIdRef.current = 1;
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
      reps: String(re.target_reps),
    }));

    nextRowIdRef.current = newRows.length;
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
      const isUntouched = row.exerciseId === null && !row.sets.trim() && !row.reps.trim();
      if (isUntouched) {
        // Fila añadida pero nunca rellenada: se ignora en silencio, no es un error.
        continue;
      }

      if (row.exerciseId === null) {
        setFormError(`Falta elegir ejercicio en la fila ${i + 1}.`);
        return;
      }

      const sets = Number(row.sets);
      const reps = Number(row.reps);
      if (!Number.isInteger(sets) || sets <= 0 || !Number.isInteger(reps) || reps <= 0) {
        setFormError("Sets y reps deben ser números enteros mayores que 0.");
        return;
      }

      exercises.push({
        exercise_id: row.exerciseId,
        target_sets: sets,
        target_reps: reps,
        order: order++,
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

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
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
              {routine.exercises
                .slice()
                .sort((a, b) => a.order - b.order)
                .map((re) => {
                  const exercise = exercises.find((e) => e.id === re.exercise_id);
                  return (
                    <Text key={re.id} style={styles.exerciseLine}>
                      {exercise?.name ?? `Ejercicio #${re.exercise_id}`} — {re.target_sets}x
                      {re.target_reps}
                    </Text>
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

            {rows.map((row) => {
              const selectedExercise = exercises.find((e) => e.id === row.exerciseId);
              return (
                <View key={row.id} style={styles.row}>
                  <TouchableOpacity
                    style={styles.pickerButton}
                    onPress={() => setPickerRowId(row.id)}
                  >
                    <Text
                      style={
                        selectedExercise ? styles.pickerButtonText : styles.pickerPlaceholderText
                      }
                    >
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
                  <TextInput
                    style={styles.numberInput}
                    placeholder="Reps"
                    keyboardType="number-pad"
                    value={row.reps}
                    onChangeText={(text) => updateRow(row.id, { reps: text })}
                  />

                  {rows.length > 1 && (
                    <Button title="Quitar" color="#b00020" onPress={() => removeRow(row.id)} />
                  )}
                </View>
              );
            })}

            <Button title="Añadir ejercicio" onPress={addRow} />

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
});
