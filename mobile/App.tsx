import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { fetchToday, TodayResponse } from "./src/api/today";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: TodayResponse };

export default function App() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    fetchToday()
      .then((data) => setState({ status: "ready", data }))
      .catch((error: Error) => setState({ status: "error", message: error.message }));
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
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
