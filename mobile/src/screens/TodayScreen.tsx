import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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

import { createWorkout } from "../api/workouts";
import { fetchToday, TodayExercise, TodayResponse } from "../api/today";
import { WorkoutSetCreate } from "../types/workout";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: TodayResponse };

type SetDraft = {
  id: number;
  weight: string;
  reps: string;
};

type ExerciseDraft = {
  exercise: TodayExercise;
  sets: SetDraft[];
};

// `nextId` es un contador compartido (no uno distinto por ejercicio) que la
// pantalla pasa desde un useRef, igual que `nextRowIdRef` en RoutinesScreen.
// Da a cada fila de serie un id estable para usar como key en vez del índice
// -- así, al quitar una fila del medio, React no reutiliza por error el
// TextInput enfocado para otra serie distinta.
function buildDraft(data: TodayResponse, nextId: () => number): ExerciseDraft[] {
  return data.exercises.map((exercise) => ({
    exercise,
    // Pre-rellena con `target_sets` filas vacías (el número de series objetivo
    // de la rutina); "+ añadir serie"/"Quitar" siguen disponibles por si un día
    // se hacen más o menos series de las planeadas.
    sets: Array.from({ length: exercise.target_sets }, () => ({
      id: nextId(),
      weight: "",
      reps: "",
    })),
  }));
}

export default function TodayScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const [state, setState] = useState<State>({ status: "loading" });
  // Recuerda si ya tenemos datos en pantalla para no tapar la vista con un
  // spinner cada vez que el usuario vuelve a esta pestaña.
  const hasDataRef = useRef(false);

  const [formRows, setFormRows] = useState<ExerciseDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Identifica qué se está logueando (fecha + rutina + firma de ejercicios/sets/reps
  // objetivo). Mientras esta clave no cambie, el formulario no se reconstruye en
  // cada focus -- si no, volver de "Historial" a "Hoy" borraría lo ya escrito (o,
  // peor, invitaría a re-guardar un entreno ya guardado como si fuera nuevo).
  const draftKeyRef = useRef<string | null>(null);
  // Copia en ref de `submitted`: la usa el useEffect de abajo para decidir si debe
  // reconstruir el draft. No puede depender del state `submitted` directamente
  // porque ese efecto también corre justo después de guardar (arriba se hace
  // setSubmitted(true)) y con state en las deps se autoborraría la confirmación
  // antes de que el usuario llegue a verla.
  const submittedRef = useRef(false);
  // Contador compartido para los ids de fila de serie (ver comentario en
  // buildDraft). Empieza en 1 y nunca se resetea entre reconstrucciones del
  // draft -- no hace falta, solo importa que cada id sea único dentro de la
  // vida de la pantalla.
  const nextSetIdRef = useRef(1);
  function nextSetId(): number {
    return nextSetIdRef.current++;
  }

  const load = useCallback(() => {
    if (!hasDataRef.current) {
      setState({ status: "loading" });
    }

    fetchToday()
      .then((data) => {
        hasDataRef.current = true;
        setState({ status: "ready", data });
      })
      .catch((error: Error) => {
        // Si ya había datos visibles, los dejamos y simplemente no se refrescan
        // esta vez, en vez de reemplazar una pantalla buena por un error.
        if (!hasDataRef.current) {
          setState({ status: "error", message: error.message });
        }
      });
  }, []);

  // useFocusEffect (de @react-navigation/native) corre cada vez que esta pantalla
  // gana el foco dentro del Tab.Navigator, no solo al montarse. Un Tab.Navigator
  // mantiene las pantallas montadas al cambiar de pestaña, así que un useEffect
  // normal solo se ejecutaría una vez y nunca vería datos creados en otra pestaña.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // /today se vuelve a pedir en cada focus (ver useFocusEffect de arriba), pero eso
  // NO debe implicar reconstruir el formulario en cada focus: si lo hiciera, entrar
  // a "Historial" a comprobar algo y volver a "Hoy" borraría lo que el usuario ya
  // había escrito (o, tras guardar, el formulario "olvidaría" que ya se guardó y
  // dejaría loguear el mismo día dos veces -- el backend no bloquea duplicados).
  // En vez de eso, el draft solo se reconstruye cuando cambia lo que realmente se
  // está logueando: la fecha, la rutina asignada, o la propia rutina (ejercicios
  // o series objetivo editados desde la pestaña "Rutinas"/"Semana").
  useEffect(() => {
    if (state.status !== "ready") {
      return;
    }

    const key = [
      state.data.date,
      state.data.routine_id,
      ...state.data.exercises.map((e) => `${e.exercise_id}:${e.target_sets}`),
    ].join("|");

    if (draftKeyRef.current === key) {
      // Mismo día, misma rutina: conserva lo que haya en pantalla, tanto si
      // el usuario sigue rellenando como si ya se guardó (submitted=true) --
      // si no, volver de otra pestaña "olvidaría" que ya se guardó hoy.
      return;
    }

    draftKeyRef.current = key;
    submittedRef.current = false;
    setFormRows(buildDraft(state.data, nextSetId));
    setFormError(null);
    setSubmitted(false);
  }, [state]);

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<SetDraft>) {
    setFormRows((prev) =>
      prev.map((row, i) => {
        if (i !== exerciseIndex) {
          return row;
        }

        const updatedSets = row.sets.map((s, j) => (j === setIndex ? { ...s, ...patch } : s));

        // Autorrelleno: al escribir el peso de una serie, se propaga a las demás
        // series del mismo ejercicio que sigan vacías (mismo ejercicio suele
        // pesar lo mismo en todas sus series). El usuario solo corrige a mano
        // las que difieran; si ya escribió algo distinto en una, esa deja de
        // tocarse porque ya no está vacía.
        if (patch.weight !== undefined && patch.weight.trim() !== "") {
          for (let j = 0; j < updatedSets.length; j++) {
            if (j !== setIndex && row.sets[j].weight.trim() === "") {
              updatedSets[j] = { ...updatedSets[j], weight: patch.weight };
            }
          }
        }

        return { ...row, sets: updatedSets };
      })
    );
  }

  function addSet(exerciseIndex: number) {
    setFormRows((prev) =>
      prev.map((row, i) => {
        if (i !== exerciseIndex) {
          return row;
        }

        // La fila nueva hereda el peso de la última serie existente (si la
        // hay y no está vacía) -- el mismo ejercicio suele pesar lo mismo en
        // todas sus series, así que ahorra tener que volver a escribirlo.
        const lastWeight = row.sets.length > 0 ? row.sets[row.sets.length - 1].weight : "";

        return {
          ...row,
          sets: [...row.sets, { id: nextSetId(), weight: lastWeight, reps: "" }],
        };
      })
    );
  }

  function removeSet(exerciseIndex: number, setIndex: number) {
    setFormRows((prev) =>
      prev.map((row, i) =>
        i === exerciseIndex ? { ...row, sets: row.sets.filter((_, j) => j !== setIndex) } : row
      )
    );
  }

  function handleLogAnother() {
    if (state.status !== "ready") {
      return;
    }
    submittedRef.current = false;
    setSubmitted(false);
    setFormRows(buildDraft(state.data, nextSetId));
    setFormError(null);
  }

  function handleSave() {
    if (state.status !== "ready") {
      return;
    }

    setFormError(null);

    const sets: WorkoutSetCreate[] = [];
    let order = 0;

    for (const row of formRows) {
      // Un ejercicio se puede saltar del todo (máquina ocupada, etc.) quitando
      // todas sus series -- si no quedó ninguna, no hay nada que validar ni
      // que mandar por este ejercicio.
      if (row.sets.length === 0) {
        continue;
      }

      for (let i = 0; i < row.sets.length; i++) {
        const draft = row.sets[i];
        // El teclado decimal-pad en un iPhone con locale español muestra coma,
        // no punto, así que "82,5" tiene que normalizarse antes de Number(...).
        const weightRaw = draft.weight.trim().replace(",", ".");
        const weight = Number(weightRaw);
        const reps = Number(draft.reps);

        if (weightRaw === "" || Number.isNaN(weight) || weight < 0) {
          setFormError(
            `Peso inválido en "${row.exercise.exercise_name}", serie ${i + 1}.`
          );
          return;
        }

        if (draft.reps.trim() === "" || !Number.isInteger(reps) || reps < 0) {
          setFormError(
            `Reps inválidas en "${row.exercise.exercise_name}", serie ${i + 1}.`
          );
          return;
        }

        sets.push({
          exercise_id: row.exercise.exercise_id,
          weight,
          reps,
          order: order++,
        });
      }
    }

    if (sets.length === 0) {
      setFormError("Añade al menos una serie antes de guardar.");
      return;
    }

    setSaving(true);
    // Se usa la fecha que ya devolvió /today (no se recalcula "hoy" en el momento
    // de guardar) para que fecha y rutina no puedan desincronizarse si la app
    // queda abierta justo a caballo de medianoche.
    createWorkout({ date: state.data.date, routine_id: state.data.routine_id, sets })
      .then(() => {
        submittedRef.current = true;
        setSubmitted(true);
      })
      .catch((error: Error) => {
        setFormError(error.message);
      })
      .finally(() => {
        setSaving(false);
      });
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {state.status === "loading" && <ActivityIndicator size="large" />}

      {state.status === "error" && (
        <View>
          <Text style={styles.title}>No se pudo conectar con el backend</Text>
          <Text style={styles.errorDetail}>{state.message}</Text>
        </View>
      )}

      {state.status === "ready" && (
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={tabBarHeight}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Hoy</Text>
            <Text style={styles.subtitle}>{state.data.routine_name ?? "Día de descanso"}</Text>

            {state.data.exercises.length === 0 && (
              <Text style={styles.restDayText}>
                No hay rutina asignada para hoy. Aprovecha para descansar.
              </Text>
            )}

            {formRows.map((row, exerciseIndex) => (
              // Una rutina puede repetir el mismo ejercicio (p.ej. press banca
              // pesado + press banca ligero), así que exercise_id solo no es una
              // key única -- se combina con la posición en la lista.
              <View key={`${row.exercise.exercise_id}-${exerciseIndex}`} style={styles.card}>
                <Text style={styles.exerciseName}>{row.exercise.exercise_name}</Text>
                <Text style={styles.targetText}>Objetivo: {row.exercise.target_sets} series</Text>

                {row.sets.map((setDraft, setIndex) => (
                  <View key={setDraft.id} style={styles.setRow}>
                    <Text style={styles.setLabel}>Serie {setIndex + 1}</Text>
                    <TextInput
                      style={styles.weightInput}
                      placeholder={row.exercise.unit}
                      keyboardType="decimal-pad"
                      value={setDraft.weight}
                      editable={!submitted && !saving}
                      onChangeText={(text) => updateSet(exerciseIndex, setIndex, { weight: text })}
                    />
                    <TextInput
                      style={styles.repsInput}
                      placeholder="reps"
                      keyboardType="number-pad"
                      value={setDraft.reps}
                      editable={!submitted && !saving}
                      onChangeText={(text) => updateSet(exerciseIndex, setIndex, { reps: text })}
                    />
                    {!submitted && (
                      <Button
                        title="Quitar"
                        color="#b00020"
                        onPress={() => removeSet(exerciseIndex, setIndex)}
                        disabled={saving}
                      />
                    )}
                  </View>
                ))}

                {!submitted && (
                  <View style={styles.addSetButton}>
                    <Button
                      title="+ añadir serie"
                      onPress={() => addSet(exerciseIndex)}
                      disabled={saving}
                    />
                  </View>
                )}
              </View>
            ))}

            {formError && <Text style={styles.errorDetail}>{formError}</Text>}

            {formRows.length > 0 && (
              <View style={styles.saveButton}>
                {submitted ? (
                  <>
                    <Text style={styles.successText}>Entreno guardado ✓</Text>
                    <View style={styles.logAnotherButton}>
                      <Button title="Loguear otro entreno" onPress={handleLogAnother} />
                    </View>
                  </>
                ) : (
                  <Button
                    title={saving ? "Guardando..." : "Guardar entreno"}
                    onPress={handleSave}
                    disabled={saving}
                  />
                )}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      )}
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
    alignItems: "stretch",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    color: "#555",
    marginBottom: 16,
    textAlign: "center",
  },
  restDayText: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginTop: 8,
  },
  card: {
    backgroundColor: "#f4f4f4",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 2,
  },
  targetText: {
    fontSize: 13,
    color: "#777",
    marginBottom: 8,
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
  },
  repsInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
  },
  saveButton: {
    marginTop: 12,
    alignItems: "center",
  },
  successText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1b8a1b",
  },
  logAnotherButton: {
    marginTop: 12,
  },
  errorDetail: {
    fontSize: 14,
    color: "#b00020",
    marginTop: 8,
    textAlign: "center",
  },
});
