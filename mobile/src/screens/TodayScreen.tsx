import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchToday, TodayResponse } from "../api/today";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: TodayResponse };

export default function TodayScreen() {
  const [state, setState] = useState<State>({ status: "loading" });
  // Recuerda si ya tenemos datos en pantalla para no tapar la vista con un
  // spinner cada vez que el usuario vuelve a esta pestaña.
  const hasDataRef = useRef(false);

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
        <View style={styles.content}>
          <Text style={styles.title}>Hoy</Text>
          <Text style={styles.subtitle}>{state.data.routine_name ?? "Día de descanso"}</Text>
          {state.data.exercises.map((exercise) => (
            <Text key={exercise.exercise_id} style={styles.exercise}>
              {exercise.exercise_name} — {exercise.target_sets}x{exercise.target_reps}
            </Text>
          ))}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  content: {
    width: "100%",
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: "#555",
    marginBottom: 16,
  },
  exercise: {
    fontSize: 16,
    marginVertical: 4,
  },
  errorDetail: {
    fontSize: 14,
    color: "#b00020",
    marginTop: 8,
    textAlign: "center",
  },
});
