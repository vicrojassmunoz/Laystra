import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import { Pressable, View } from "react-native";

import {
  createHabit,
  deleteHabit,
  fetchHabits,
  fetchHabitsToday,
  logHabit,
  updateHabit,
} from "../api/habits";
import { todayIsoDate } from "../api/today";
import PickerField from "../components/PickerField";
import Button from "../components/ui/Button";
import { Card, SectionHeader } from "../components/ui/Card";
import Chip from "../components/ui/Chip";
import Icon from "../components/ui/Icon";
import ProgressBar from "../components/ui/ProgressBar";
import Screen, { ScreenError, ScreenLoading } from "../components/ui/Screen";
import TextField from "../components/ui/TextField";
import Txt from "../components/ui/Txt";
import { haptic } from "../motion/motion";
import { makeStyles, space, useTheme } from "../theme/theme";
import { Habit, HabitKind, HabitProgress } from "../types/habit";
import { showAlert } from "../utils/alert";
import { ensureReminderPermission, syncHabitReminders } from "../utils/habitReminders";
import { parseDecimalInput } from "../utils/number";
import { STEPS_GOAL, formatSteps } from "../utils/steps";
import { formatMl } from "../utils/water";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; today: HabitProgress[]; inactive: Habit[] };

const KIND_LABEL: Record<HabitKind, string> = {
  water: "Agua",
  steps: "Pasos",
  check: "Check",
  count: "Contador",
};

function progressText(item: HabitProgress): string {
  const { habit, progress, target } = item;
  switch (habit.kind) {
    case "water":
      return target ? `${formatMl(progress)} / ${formatMl(target)}` : formatMl(progress);
    case "steps":
      return `${formatSteps(Math.round(progress))} / ${formatSteps(target ?? STEPS_GOAL)}`;
    case "count": {
      const unit = habit.unit ? ` ${habit.unit}` : "";
      return target ? `${progress} / ${target}${unit}` : `${progress}${unit}`;
    }
    case "check":
      return item.done ? "Hecho" : "Pendiente";
  }
}

function payloadOf(h: Habit, patch: Partial<Habit> = {}) {
  const m = { ...h, ...patch };
  return {
    name: m.name,
    kind: m.kind,
    target: m.target,
    unit: m.unit,
    reminder_time: m.reminder_time,
    active: m.active,
    position: m.position,
  };
}

// Hábitos de hoy: water y steps son integrados (su progreso viene de Agua y del
// podómetro; aquí solo se ven, se les pone recordatorio/meta o se desactivan).
// check y count se registran aquí.
export default function HabitosScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [state, setState] = useState<State>({ status: "loading" });
  const hasDataRef = useRef(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // Hábitos de contador con una petición en curso: evita perder incrementos
  // con toques rápidos (cada toque calcula sobre el valor ya confirmado).
  const busyRef = useRef(new Set<number>());
  const [busyIds, setBusyIds] = useState<number[]>([]);

  // Formulario: creating (alta) o editing (edición). Solo check/count se crean.
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Habit | null>(null);
  const formOpen = creating || editing !== null;
  const [name, setName] = useState("");
  const [kind, setKind] = useState<HabitKind>("check");
  const [target, setTarget] = useState("");
  const [unit, setUnit] = useState("");
  const [reminder, setReminder] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!hasDataRef.current) setState({ status: "loading" });
    Promise.all([fetchHabitsToday(todayIsoDate()), fetchHabits()])
      .then(([today, all]) => {
        hasDataRef.current = true;
        setState({ status: "ready", today, inactive: all.filter((h) => !h.active) });
      })
      .catch((error: Error) => {
        if (!hasDataRef.current) setState({ status: "error", message: error.message });
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function resetForm() {
    setCreating(false);
    setEditing(null);
    setName("");
    setKind("check");
    setTarget("");
    setUnit("");
    setReminder(null);
    setFormError(null);
  }

  function startEdit(h: Habit) {
    setCreating(false);
    setEditing(h);
    setName(h.name);
    setKind(h.kind);
    setTarget(h.target !== null ? String(h.target) : "");
    setUnit(h.unit ?? "");
    setReminder(h.reminder_time);
    setFormError(null);
  }

  // Tras cualquier cambio: refrescar y reprogramar (completar cancela el de hoy).
  function afterChange() {
    load();
    void syncHabitReminders();
  }

  // Registra check (0|1) o count y sustituye el item devuelto en la lista.
  function log(item: HabitProgress, value: number) {
    if (busyRef.current.has(item.habit.id)) return;
    busyRef.current.add(item.habit.id);
    setBusyIds(Array.from(busyRef.current));
    setActionError(null);
    logHabit(item.habit.id, todayIsoDate(), value)
      .then((updated) => {
        setState((prev) =>
          prev.status === "ready"
            ? {
                ...prev,
                today: prev.today.map((t) => (t.habit.id === updated.habit.id ? updated : t)),
              }
            : prev
        );
        if (updated.done && !item.done) haptic.success();
        void syncHabitReminders();
      })
      .catch((error: Error) => setActionError(error.message))
      .finally(() => {
        busyRef.current.delete(item.habit.id);
        setBusyIds(Array.from(busyRef.current));
      });
  }

  function setActive(h: Habit, active: boolean) {
    setActionError(null);
    updateHabit(h.id, payloadOf(h, { active }))
      .then(() => {
        resetForm();
        afterChange();
      })
      .catch((error: Error) => setActionError(error.message));
  }

  function confirmDelete(h: Habit) {
    showAlert("¿Borrar hábito?", `Se borrará "${h.name}" y su registro.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: () => {
          deleteHabit(h.id)
            .then(() => {
              resetForm();
              afterChange();
            })
            .catch((error: Error) => setActionError(error.message));
        },
      },
    ]);
  }

  async function handleSave() {
    setFormError(null);
    if (!name.trim()) {
      setFormError("Ponle un nombre al hábito.");
      return;
    }
    const formKindNow = editing ? editing.kind : kind;
    let targetValue: number | null = null;
    if ((formKindNow === "steps" || formKindNow === "count") && target.trim() !== "") {
      targetValue = parseDecimalInput(target);
      if (targetValue === null || targetValue <= 0) {
        setFormError("La meta debe ser un número mayor que 0.");
        return;
      }
    }
    if (reminder !== null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(reminder)) {
      setFormError("Hora inválida. Usa el formato HH:MM.");
      return;
    }

    setSaving(true);
    try {
      // Primer recordatorio: aquí se pide el permiso de notificaciones.
      // Solo si el recordatorio es nuevo o cambió (no en cada guardado).
      if (reminder !== null && reminder !== (editing?.reminder_time ?? null)) {
        const ok = await ensureReminderPermission();
        if (!ok) {
          showAlert(
            "Notificaciones desactivadas",
            "El hábito se guarda, pero no sonará el recordatorio hasta que las actives en Ajustes."
          );
        }
      }
      const cleanUnit = formKindNow === "count" && unit.trim() !== "" ? unit.trim() : null;
      if (editing) {
        await updateHabit(
          editing.id,
          payloadOf(editing, {
            name: name.trim(),
            target: targetValue,
            unit: editing.kind === "count" ? cleanUnit : editing.unit,
            reminder_time: reminder,
          })
        );
      } else {
        const position =
          state.status === "ready"
            ? Math.max(0, ...state.today.map((t) => t.habit.position)) + 1
            : 0;
        await createHabit({
          name: name.trim(),
          kind,
          target: targetValue,
          unit: cleanUnit,
          reminder_time: reminder,
          active: true,
          position,
        });
      }
      resetForm();
      afterChange();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (state.status === "loading") return <ScreenLoading />;
  if (state.status === "error") return <ScreenError message={state.message} />;

  const { today, inactive } = state;
  const formKind = editing ? editing.kind : kind;
  const builtIn = formKind === "water" || formKind === "steps";

  function renderItem(item: HabitProgress) {
    const { habit } = item;
    const ratio = item.target ? item.progress / item.target : item.done ? 1 : 0;
    return (
      <Card key={habit.id}>
        <View style={styles.itemRow}>
          {habit.kind === "check" ? (
            <Pressable
              onPress={() => log(item, item.done ? 0 : 1)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: item.done }}
              accessibilityLabel={`Marcar ${habit.name}`}
              style={styles.toggle}
            >
              <Icon
                name={item.done ? "check" : "circle"}
                size={26}
                color={item.done ? colors.success : colors.labelTertiary}
              />
            </Pressable>
          ) : null}
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="headline">{habit.name}</Txt>
            <Txt variant="subhead" tone="secondary" numeric>
              {progressText(item)}
              {habit.reminder_time ? ` · ${habit.reminder_time}` : ""}
            </Txt>
          </View>
          {habit.kind === "count" ? (
            <View style={styles.stepper}>
              <Button
                title="Restar uno"
                icon="minus"
                iconOnly
                variant="tinted"
                size="compact"
                disabled={item.progress <= 0 || busyIds.includes(habit.id)}
                onPress={() => log(item, Math.max(0, item.progress - 1))}
              />
              <Button
                title="Sumar uno"
                icon="plus"
                iconOnly
                variant="tinted"
                size="compact"
                disabled={busyIds.includes(habit.id)}
                onPress={() => log(item, item.progress + 1)}
              />
            </View>
          ) : null}
          <Button title="Editar" variant="plain" size="compact" onPress={() => startEdit(habit)} />
        </View>
        {habit.kind !== "check" ? (
          <ProgressBar
            value={ratio}
            tone={habit.kind === "water" ? "water" : item.done ? "success" : "tint"}
          />
        ) : null}
      </Card>
    );
  }

  return (
    <Screen>
      {!formOpen ? (
        <Button
          title="Nuevo hábito"
          icon="plus"
          variant="filled"
          size="large"
          fullWidth
          onPress={() => setCreating(true)}
        />
      ) : (
        <Card>
          <Txt variant="title3">{editing ? "Editar hábito" : "Nuevo hábito"}</Txt>
          <TextField
            placeholder="Nombre (p. ej. Creatina)"
            value={name}
            onChangeText={setName}
            accessibilityLabel="Nombre del hábito"
          />
          {editing ? (
            <Txt variant="subhead" tone="secondary">
              Tipo: {KIND_LABEL[editing.kind]}
              {builtIn ? " (integrado: se registra en su pantalla)" : ""}
            </Txt>
          ) : (
            <View style={styles.chips}>
              <Chip label="Check" selected={kind === "check"} onPress={() => setKind("check")} />
              <Chip label="Contador" selected={kind === "count"} onPress={() => setKind("count")} />
            </View>
          )}
          {formKind === "steps" || formKind === "count" ? (
            <TextField
              placeholder={formKind === "steps" ? "Meta de pasos al día" : "Meta al día (opcional)"}
              keyboardType="decimal-pad"
              value={target}
              onChangeText={setTarget}
              accessibilityLabel="Meta"
            />
          ) : null}
          {formKind === "count" ? (
            <TextField
              placeholder="Unidad (opcional, p. ej. vasos)"
              value={unit}
              onChangeText={setUnit}
              accessibilityLabel="Unidad"
            />
          ) : null}
          <PickerField mode="time" label="Recordatorio" value={reminder} onChange={setReminder} />

          {formError ? (
            <Txt variant="subhead" tone="danger">
              {formError}
            </Txt>
          ) : null}

          <Button
            title={saving ? "Guardando..." : editing ? "Guardar cambios" : "Guardar hábito"}
            variant="filled"
            size="large"
            fullWidth
            onPress={() => void handleSave()}
            disabled={saving}
          />
          <Button title="Cancelar" variant="plain" fullWidth onPress={resetForm} disabled={saving} />
          {editing ? (
            <>
              <Button
                title="Desactivar"
                variant="plain"
                fullWidth
                disabled={saving}
                onPress={() => setActive(editing, false)}
              />
              {!builtIn ? (
                <Button
                  title="Borrar hábito"
                  variant="destructive"
                  fullWidth
                  disabled={saving}
                  onPress={() => confirmDelete(editing)}
                />
              ) : null}
            </>
          ) : null}
        </Card>
      )}

      {actionError ? (
        <Txt variant="subhead" tone="danger">
          {actionError}
        </Txt>
      ) : null}

      {today.length === 0 && !formOpen ? (
        <Card>
          <Txt variant="headline">No hay hábitos activos</Txt>
          <Txt variant="subhead" tone="secondary">
            Crea uno (creatina, estiramientos...) y ponle un recordatorio si quieres.
          </Txt>
        </Card>
      ) : null}

      {today.length > 0 ? (
        <View style={{ gap: space.md }}>
          <SectionHeader>Hoy</SectionHeader>
          {today.map(renderItem)}
        </View>
      ) : null}

      {inactive.length > 0 ? (
        <View style={{ gap: space.md }}>
          <SectionHeader>{`Desactivados (${inactive.length})`}</SectionHeader>
          {inactive.map((h) => (
            <Card key={h.id}>
              <View style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Txt variant="headline" tone="secondary">
                    {h.name}
                  </Txt>
                  <Txt variant="subhead" tone="secondary">
                    {KIND_LABEL[h.kind]}
                  </Txt>
                </View>
                <Button title="Activar" variant="tinted" size="compact" onPress={() => setActive(h, true)} />
                {h.kind === "check" || h.kind === "count" ? (
                  <Button
                    title="Borrar"
                    variant="plainDestructive"
                    size="compact"
                    onPress={() => confirmDelete(h)}
                  />
                ) : null}
              </View>
            </Card>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  itemRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  toggle: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -space.sm },
  stepper: { flexDirection: "row", gap: space.sm },
  chips: { flexDirection: "row", gap: space.sm },
}));
