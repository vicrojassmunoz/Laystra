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

import { fetchRoutines } from "../api/routines";
import { fetchSchedule, updateScheduleDay } from "../api/schedule";
import { Routine } from "../types/routine";
import { ScheduleEntry } from "../types/schedule";

const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; schedule: ScheduleEntry[]; routines: Routine[] };

export default function ScheduleScreen() {
  const [state, setState] = useState<State>({ status: "loading" });
  const hasDataRef = useRef(false);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [updating, setUpdating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!hasDataRef.current) {
      setState({ status: "loading" });
    }

    Promise.all([fetchSchedule(), fetchRoutines()])
      .then(([schedule, routines]) => {
        hasDataRef.current = true;
        setState({ status: "ready", schedule, routines });
      })
      .catch((error: Error) => {
        if (!hasDataRef.current) {
          setState({ status: "error", message: error.message });
        }
      });
  }, []);

  // Corre cada vez que la pestaña "Semana" gana foco (no solo al montar), para
  // reflejar rutinas creadas o el día de hoy asignado desde otras pestañas.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function openDayModal(day: number) {
    setModalError(null);
    setOpenDay(day);
  }

  function closeDayModal() {
    setModalError(null);
    setOpenDay(null);
  }

  async function handleSelect(day: number, routineId: number | null) {
    setModalError(null);
    setUpdating(true);
    try {
      const updated = await updateScheduleDay(day, routineId);
      setState((prev) =>
        prev.status === "ready"
          ? {
              ...prev,
              schedule: prev.schedule.map((entry) => (entry.day === day ? updated : entry)),
            }
          : prev
      );
      closeDayModal();
    } catch (error) {
      setModalError((error as Error).message);
    } finally {
      setUpdating(false);
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

  const { schedule, routines } = state;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Semana</Text>

        {schedule
          .slice()
          .sort((a, b) => a.day - b.day)
          .map((entry) => {
            const routine = routines.find((r) => r.id === entry.routine_id);
            return (
              <TouchableOpacity
                key={entry.day}
                style={styles.dayRow}
                onPress={() => openDayModal(entry.day)}
              >
                <Text style={styles.dayLabel}>{DAY_LABELS[entry.day]}</Text>
                <Text style={styles.dayValue}>{routine?.name ?? "Descanso"}</Text>
              </TouchableOpacity>
            );
          })}
      </ScrollView>

      <Modal visible={openDay !== null} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {openDay !== null ? DAY_LABELS[openDay] : ""}
            </Text>

            <TouchableOpacity
              style={styles.option}
              disabled={updating}
              onPress={() => openDay !== null && handleSelect(openDay, null)}
            >
              <Text style={styles.optionText}>Descanso</Text>
            </TouchableOpacity>

            {routines.map((routine) => (
              <TouchableOpacity
                key={routine.id}
                style={styles.option}
                disabled={updating}
                onPress={() => openDay !== null && handleSelect(openDay, routine.id)}
              >
                <Text style={styles.optionText}>{routine.name}</Text>
              </TouchableOpacity>
            ))}

            {modalError && <Text style={styles.errorDetail}>{modalError}</Text>}

            <TouchableOpacity style={styles.cancelButton} onPress={closeDayModal}>
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
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
  },
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#f4f4f4",
    borderRadius: 8,
    marginBottom: 8,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: "600",
  },
  dayValue: {
    fontSize: 16,
    color: "#555",
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
  errorDetail: {
    fontSize: 14,
    color: "#b00020",
    marginTop: 8,
    textAlign: "center",
  },
});
