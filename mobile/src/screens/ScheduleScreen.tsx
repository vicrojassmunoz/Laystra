import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import { Modal, Pressable, View } from "react-native";

import { fetchRoutines } from "../api/routines";
import { fetchSchedule, updateScheduleDay } from "../api/schedule";
import Button from "../components/ui/Button";
import { Section } from "../components/ui/Card";
import Icon from "../components/ui/Icon";
import Row from "../components/ui/Row";
import Screen, { ScreenError, ScreenLoading } from "../components/ui/Screen";
import Txt from "../components/ui/Txt";
import { makeStyles, radius, space, useTheme } from "../theme/theme";
import { Routine } from "../types/routine";
import { ScheduleEntry } from "../types/schedule";

const DAY_LABELS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; schedule: ScheduleEntry[]; routines: Routine[] };

const useStyles = makeStyles(({ colors }) => ({
  value: { flexDirection: "row", alignItems: "center", gap: space.sm },
  todayTag: {
    paddingVertical: 2,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.tintSoft,
  },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: space.xl,
    paddingBottom: space.xxxl,
    gap: space.md,
    maxHeight: "85%",
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.labelTertiary,
  },
}));

export default function ScheduleScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [state, setState] = useState<State>({ status: "loading" });
  const hasDataRef = useRef(false);
  const [openDay, setOpenDay] = useState<number | null>(null);
  const [updating, setUpdating] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // 0 = lunes ... 6 = domingo, mismo convenio que ScheduleEntry.day.
  const todayIndex = (new Date().getDay() + 6) % 7;

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

  // Corre cada vez que la pantalla gana foco (no solo al montar), para reflejar
  // rutinas creadas o el día de hoy asignado desde otras pantallas.
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
    return <ScreenLoading />;
  }
  if (state.status === "error") {
    return <ScreenError message={state.message} />;
  }

  const { schedule, routines } = state;
  const sorted = schedule.slice().sort((a, b) => a.day - b.day);
  const openEntry = openDay !== null ? schedule.find((e) => e.day === openDay) : undefined;

  return (
    <Screen>
      <Txt variant="subhead" tone="secondary">
        Toca un día para asignarle una rutina o dejarlo de descanso.
      </Txt>

      <Section>
        {sorted.map((entry) => {
          const routine = routines.find((r) => r.id === entry.routine_id);
          const isToday = entry.day === todayIndex;
          return (
            <Row
              key={entry.day}
              title={DAY_LABELS[entry.day]}
              titleTone="label"
              subtitle={
                routine
                  ? `${routine.exercises.length} ejercicio${routine.exercises.length === 1 ? "" : "s"}`
                  : undefined
              }
              value={
                <View style={styles.value}>
                  {isToday ? (
                    <View style={styles.todayTag}>
                      <Txt variant="caption" tone="tint" weight="700">
                        Hoy
                      </Txt>
                    </View>
                  ) : null}
                  <Txt variant="body" tone={routine ? "label" : "secondary"}>
                    {routine?.name ?? "Descanso"}
                  </Txt>
                </View>
              }
              onPress={() => openDayModal(entry.day)}
            />
          );
        })}
      </Section>

      <Modal visible={openDay !== null} transparent animationType="slide" onRequestClose={closeDayModal}>
        <Pressable style={styles.backdrop} onPress={closeDayModal}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.grabber} />
            <Txt variant="title3" style={{ textAlign: "center" }}>
              {openDay !== null ? DAY_LABELS[openDay] : ""}
            </Txt>

            <Section>
              <Row
                title="Descanso"
                chevron={false}
                value={
                  openEntry && openEntry.routine_id === null ? (
                    <Icon name="check" size={20} color={colors.tint} />
                  ) : undefined
                }
                onPress={updating ? undefined : () => openDay !== null && handleSelect(openDay, null)}
              />
              {routines.map((routine) => (
                <Row
                  key={routine.id}
                  title={routine.name}
                  subtitle={`${routine.exercises.length} ejercicio${routine.exercises.length === 1 ? "" : "s"}`}
                  chevron={false}
                  value={
                    openEntry && openEntry.routine_id === routine.id ? (
                      <Icon name="check" size={20} color={colors.tint} />
                    ) : undefined
                  }
                  onPress={
                    updating ? undefined : () => openDay !== null && handleSelect(openDay, routine.id)
                  }
                />
              ))}
            </Section>

            {modalError ? (
              <Txt variant="subhead" tone="danger">
                {modalError}
              </Txt>
            ) : null}

            <Button title="Cancelar" variant="tinted" size="large" fullWidth onPress={closeDayModal} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
