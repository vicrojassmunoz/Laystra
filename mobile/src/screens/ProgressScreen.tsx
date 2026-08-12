import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchExercises } from "../api/exercises";
import { fetchProgress } from "../api/progress";
import { Exercise } from "../types/exercise";
import { ProgressResponse } from "../types/progress";

type ExercisesState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; exercises: Exercise[] };

type ProgressState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ProgressResponse };

export default function ProgressScreen() {
  const [exercisesState, setExercisesState] = useState<ExercisesState>({ status: "loading" });
  const hasExercisesRef = useRef(false);

  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const selectedExerciseRef = useRef<Exercise | null>(null);
  const [progressState, setProgressState] = useState<ProgressState>({ status: "idle" });
  const [pickerVisible, setPickerVisible] = useState(false);

  const loadExercises = useCallback(() => {
    if (!hasExercisesRef.current) {
      setExercisesState({ status: "loading" });
    }

    fetchExercises()
      .then((exercises) => {
        hasExercisesRef.current = true;
        setExercisesState({ status: "ready", exercises });
      })
      .catch((error: Error) => {
        if (!hasExercisesRef.current) {
          setExercisesState({ status: "error", message: error.message });
        }
      });
  }, []);

  const loadProgress = useCallback((exerciseId: number) => {
    setProgressState({ status: "loading" });
    fetchProgress(exerciseId)
      .then((data) => {
        // Descarta la respuesta si mientras tanto se seleccionó otro ejercicio
        // (dos selecciones seguidas o una coincidiendo con el refetch de foco).
        if (selectedExerciseRef.current?.id === data.exercise_id) {
          setProgressState({ status: "ready", data });
        }
      })
      .catch((error: Error) => {
        if (selectedExerciseRef.current?.id === exerciseId) {
          setProgressState({ status: "error", message: error.message });
        }
      });
  }, []);

  // Corre cada vez que la pestaña "Progreso" gana foco (no solo al montar), para
  // reflejar entrenos logueados desde "Hoy" desde la última visita a esta pestaña.
  // Lee selectedExerciseRef (no el state) para tener el valor vigente al momento
  // del foco sin que este useCallback quede atado a selectedExercise como dep.
  useFocusEffect(
    useCallback(() => {
      loadExercises();
      if (selectedExerciseRef.current) {
        loadProgress(selectedExerciseRef.current.id);
      }
    }, [loadExercises, loadProgress])
  );

  function selectExercise(exercise: Exercise) {
    setSelectedExercise(exercise);
    selectedExerciseRef.current = exercise;
    setPickerVisible(false);
    loadProgress(exercise.id);
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Progreso</Text>

        {exercisesState.status === "loading" && <ActivityIndicator size="large" />}

        {exercisesState.status === "error" && (
          <>
            <Text style={styles.errorTitle}>No se pudo conectar con el backend</Text>
            <Text style={styles.errorDetail}>{exercisesState.message}</Text>
          </>
        )}

        {exercisesState.status === "ready" && (
          <>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setPickerVisible(true)}
            >
              <Text
                style={selectedExercise ? styles.pickerButtonText : styles.pickerPlaceholderText}
              >
                {selectedExercise ? selectedExercise.name : "Elige un ejercicio"}
              </Text>
              {selectedExercise && <Text style={styles.pickerChangeText}>Cambiar</Text>}
            </TouchableOpacity>

            {selectedExercise === null && (
              <Text style={styles.emptyText}>
                Elige un ejercicio para ver su evolución.
              </Text>
            )}

            {selectedExercise !== null && progressState.status === "loading" && (
              <ActivityIndicator size="large" style={styles.progressLoading} />
            )}

            {selectedExercise !== null && progressState.status === "error" && (
              <>
                <Text style={styles.errorTitle}>No se pudo cargar el progreso</Text>
                <Text style={styles.errorDetail}>{progressState.message}</Text>
              </>
            )}

            {selectedExercise !== null && progressState.status === "ready" && (
              <Text style={styles.subtitle}>{progressState.data.exercise_name}</Text>
            )}

            {selectedExercise !== null &&
              progressState.status === "ready" &&
              progressState.data.points.length === 0 && (
                <Text style={styles.emptyText}>Sin entrenos registrados todavía.</Text>
              )}

            {selectedExercise !== null &&
              progressState.status === "ready" &&
              progressState.data.points.length > 0 &&
              progressState.data.points
                .slice()
                .reverse()
                .map((point) => (
                  <View key={point.workout_id} style={styles.card}>
                    <Text style={styles.date}>{point.date}</Text>
                    <Text style={styles.pointLine}>
                      Mejor peso: {point.best_weight}
                      {selectedExercise.unit}
                    </Text>
                    <Text style={styles.pointLine}>Reps totales: {point.total_reps}</Text>
                  </View>
                ))}
          </>
        )}
      </ScrollView>

      <Modal visible={pickerVisible} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Elige un ejercicio</Text>

            <ScrollView>
              {exercisesState.status === "ready" &&
                exercisesState.exercises.map((exercise) => (
                  <TouchableOpacity
                    key={exercise.id}
                    style={styles.option}
                    onPress={() => selectExercise(exercise)}
                  >
                    <Text style={styles.optionText}>{exercise.name}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setPickerVisible(false)}>
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
    marginTop: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#777",
    marginBottom: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  errorDetail: {
    fontSize: 14,
    color: "#b00020",
    marginTop: 8,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  pickerButtonText: {
    fontSize: 16,
    color: "#000",
    fontWeight: "600",
  },
  pickerPlaceholderText: {
    fontSize: 16,
    color: "#999",
  },
  pickerChangeText: {
    fontSize: 14,
    color: "#0066cc",
  },
  progressLoading: {
    marginTop: 24,
  },
  card: {
    backgroundColor: "#f4f4f4",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  date: {
    fontSize: 14,
    color: "#555",
    marginBottom: 4,
  },
  pointLine: {
    fontSize: 15,
    color: "#333",
    marginVertical: 2,
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
