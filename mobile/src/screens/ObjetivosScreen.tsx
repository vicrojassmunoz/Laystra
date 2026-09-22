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
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { createGoal, deleteGoal, fetchGoals, updateGoal } from "../api/goals";
import { Goal } from "../types/goal";
import { parseDecimalInput } from "../utils/number";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; goals: Goal[] };

// Objetivos: CRUD manual, mismo patrón de formulario alta/edición que
// RoutinesScreen (editingId null = alta, no-null = edición). El backend tiene
// PUT de reemplazo total, así que el toggle de "hecho" reutiliza el mismo
// updateGoal que editar texto/objetivo -- ver toggleDone.
export default function ObjetivosScreen() {
  const [state, setState] = useState<State>({ status: "loading" });
  const hasDataRef = useRef(false);

  const [text, setText] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // null = formulario en modo "Nuevo objetivo"; si tiene un id, está editando
  // ese objetivo (PUT en vez de POST al guardar), igual que en RoutinesScreen.
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = useCallback(() => {
    if (!hasDataRef.current) {
      setState({ status: "loading" });
    }

    fetchGoals()
      .then((goals) => {
        hasDataRef.current = true;
        setState({ status: "ready", goals });
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

  function resetForm() {
    setEditingId(null);
    setText("");
    setTargetValue("");
    setTargetDate("");
    setFormError(null);
  }

  function startEdit(goal: Goal) {
    setEditingId(goal.id);
    setText(goal.text);
    setTargetValue(goal.target_value !== null ? String(goal.target_value) : "");
    setTargetDate(goal.target_date ?? "");
    setFormError(null);
  }

  function confirmDelete(goal: Goal) {
    Alert.alert("¿Borrar objetivo?", `Se borrará "${goal.text}" permanentemente.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: () => handleDelete(goal.id),
      },
    ]);
  }

  function handleDelete(id: number) {
    setActionError(null);
    deleteGoal(id)
      .then(() => {
        if (editingId === id) {
          resetForm();
        }
        load();
      })
      .catch((error: Error) => setActionError(error.message));
  }

  // Toggle de "hecho": reusa el mismo PUT de reemplazo total que editar
  // texto/objetivo, solo cambiando el campo done.
  function toggleDone(goal: Goal) {
    setActionError(null);
    updateGoal(goal.id, {
      text: goal.text,
      target_value: goal.target_value,
      target_date: goal.target_date,
      done: !goal.done,
    })
      .then(() => load())
      .catch((error: Error) => setActionError(error.message));
  }

  function handleSave() {
    setFormError(null);

    if (!text.trim()) {
      setFormError("Ponle un texto al objetivo.");
      return;
    }

    let targetValueParsed: number | null = null;
    if (targetValue.trim() !== "") {
      targetValueParsed = parseDecimalInput(targetValue);
      if (targetValueParsed === null) {
        setFormError("Valor objetivo inválido.");
        return;
      }
    }

    const targetDateValue = targetDate.trim() !== "" ? targetDate.trim() : null;
    // Opcional -- solo se valida el formato si el usuario escribió algo.
    if (targetDateValue !== null && !/^\d{4}-\d{2}-\d{2}$/.test(targetDateValue)) {
      setFormError("Fecha objetivo inválida. Usa el formato AAAA-MM-DD.");
      return;
    }

    setSaving(true);
    const promise =
      editingId !== null
        ? updateGoal(editingId, {
            text: text.trim(),
            target_value: targetValueParsed,
            target_date: targetDateValue,
            done: state.status === "ready"
              ? state.goals.find((g) => g.id === editingId)?.done ?? false
              : false,
          })
        : createGoal({
            text: text.trim(),
            target_value: targetValueParsed,
            target_date: targetDateValue,
          });

    promise
      .then(() => {
        resetForm();
        load();
      })
      .catch((error: Error) => setFormError(error.message))
      .finally(() => setSaving(false));
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

  const { goals } = state;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Igual que UserScreen/AnalisisScreen: esta pantalla vive en el Stack
          raíz (pusheada desde Home), no dentro del Tab.Navigator, así que no
          hay tab bar debajo que compensar -- offset 0, sin
          useBottomTabBarHeight(). */}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Sin título propio: pantalla pusheada desde Home, header nativo ya
              muestra "Objetivos" (ver App.tsx). Igual que UserScreen. */}
          {goals.length === 0 && (
            <Text style={styles.emptyText}>Todavía no hay objetivos.</Text>
          )}

          {actionError && <Text style={styles.errorDetail}>{actionError}</Text>}

          {goals.map((goal) => (
            <View key={goal.id} style={styles.card}>
              <TouchableOpacity style={styles.checkboxRow} onPress={() => toggleDone(goal)}>
                <View style={[styles.checkbox, goal.done && styles.checkboxChecked]}>
                  {goal.done && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <View style={styles.checkboxTextWrap}>
                  <Text style={[styles.goalText, goal.done && styles.goalTextDone]}>
                    {goal.text}
                  </Text>
                  {(goal.target_value !== null || goal.target_date !== null) && (
                    <Text style={styles.goalMeta}>
                      {goal.target_value !== null ? `Objetivo: ${goal.target_value}` : ""}
                      {goal.target_value !== null && goal.target_date !== null ? " · " : ""}
                      {goal.target_date !== null ? `Fecha: ${goal.target_date}` : ""}
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
              <View style={styles.cardActions}>
                <Button title="Editar" onPress={() => startEdit(goal)} />
                <Button title="Borrar" color="#b00020" onPress={() => confirmDelete(goal)} />
              </View>
            </View>
          ))}

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>
              {editingId !== null ? "Editar objetivo" : "Nuevo objetivo"}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Texto del objetivo"
              value={text}
              onChangeText={setText}
            />

            <TextInput
              style={styles.input}
              placeholder="Valor objetivo (opcional)"
              keyboardType="decimal-pad"
              value={targetValue}
              onChangeText={setTargetValue}
            />

            <TextInput
              style={styles.input}
              placeholder="Fecha objetivo AAAA-MM-DD (opcional)"
              value={targetDate}
              onChangeText={setTargetDate}
              autoCapitalize="none"
              autoCorrect={false}
            />

            {formError && <Text style={styles.errorDetail}>{formError}</Text>}

            <View style={styles.saveButton}>
              <Button
                title={
                  saving ? "Guardando..." : editingId !== null ? "Guardar cambios" : "Guardar objetivo"
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
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#3b5bdb",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: "#3b5bdb",
  },
  checkboxMark: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  checkboxTextWrap: {
    flex: 1,
  },
  goalText: {
    fontSize: 16,
    fontWeight: "600",
  },
  goalTextDone: {
    textDecorationLine: "line-through",
    color: "#888",
  },
  goalMeta: {
    fontSize: 13,
    color: "#777",
    marginTop: 2,
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
  saveButton: {
    marginTop: 4,
  },
  cancelEditButton: {
    marginTop: 8,
  },
  errorDetail: {
    fontSize: 14,
    color: "#b00020",
    marginTop: 8,
  },
});
