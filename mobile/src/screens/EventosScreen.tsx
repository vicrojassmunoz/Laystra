import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import { Pressable, View } from "react-native";

import { createGoal, deleteGoal, fetchGoals, updateGoal } from "../api/goals";
import { todayIsoDate } from "../api/today";
import PickerField from "../components/PickerField";
import Button from "../components/ui/Button";
import { Card, SectionHeader } from "../components/ui/Card";
import Icon from "../components/ui/Icon";
import Screen, { ScreenError, ScreenLoading } from "../components/ui/Screen";
import TextField from "../components/ui/TextField";
import Txt from "../components/ui/Txt";
import { haptic } from "../motion/motion";
import { makeStyles, space, useTheme } from "../theme/theme";
import { Goal } from "../types/goal";
import { showAlert } from "../utils/alert";
import { countdownLabel, daysUntil } from "../utils/events";
import { parseDecimalInput } from "../utils/number";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; goals: Goal[] };

// Eventos (antes Objetivos; mismos Goal del backend): CRUD manual, mismo patrón de formulario alta/edición que
// RoutinesScreen (editingId null = alta, no-null = edición). El backend tiene
// PUT de reemplazo total, así que el toggle de "hecho" reutiliza el mismo
// updateGoal que editar texto/objetivo -- ver toggleDone.
export default function EventosScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [state, setState] = useState<State>({ status: "loading" });
  const hasDataRef = useRef(false);

  const [text, setText] = useState("");
  const [targetValue, setTargetValue] = useState("");
  const [targetDate, setTargetDate] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // null = formulario en modo "Nuevo evento"; si tiene un id, está editando
  // ese objetivo (PUT en vez de POST al guardar), igual que en RoutinesScreen.
  const [editingId, setEditingId] = useState<number | null>(null);
  // El formulario solo se muestra al crear (botón "Nuevo evento") o al editar.
  const [creating, setCreating] = useState(false);
  const formOpen = creating || editingId !== null;

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
    setCreating(false);
    setText("");
    setTargetValue("");
    setTargetDate(null);
    setFormError(null);
  }

  function startEdit(goal: Goal) {
    setEditingId(goal.id);
    setText(goal.text);
    setTargetValue(goal.target_value !== null ? String(goal.target_value) : "");
    setTargetDate(goal.target_date);
    setFormError(null);
  }

  function confirmDelete(goal: Goal) {
    showAlert("¿Borrar evento?", `Se borrará "${goal.text}" permanentemente.`, [
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
      .then(() => {
        if (!goal.done) {
          haptic.success();
        }
        load();
      })
      .catch((error: Error) => setActionError(error.message));
  }

  function handleSave() {
    setFormError(null);

    if (!text.trim()) {
      setFormError("Ponle un título al evento.");
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

    const targetDateValue = targetDate;
    // Opcional -- solo se valida el formato si el usuario escribió algo.
    if (targetDateValue !== null && !/^\d{4}-\d{2}-\d{2}$/.test(targetDateValue)) {
      setFormError("Fecha inválida. Usa el formato AAAA-MM-DD.");
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
    return <ScreenLoading />;
  }
  if (state.status === "error") {
    return <ScreenError message={state.message} />;
  }

  const { goals } = state;
  // Con fecha primero (la más cercana arriba); sin fecha al final.
  const pending = goals
    .filter((g) => !g.done)
    .sort((a, b) =>
      a.target_date === b.target_date
        ? a.id - b.id
        : a.target_date === null
          ? 1
          : b.target_date === null
            ? -1
            : a.target_date.localeCompare(b.target_date)
    );
  const done = goals.filter((g) => g.done);
  const today = todayIsoDate();

  function renderGoal(goal: Goal) {
    const days = goal.target_date ? daysUntil(goal.target_date, today) : null;
    return (
      <Card key={goal.id}>
        <View style={styles.goalRow}>
          <Pressable
            onPress={() => toggleDone(goal)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: goal.done }}
            accessibilityLabel={goal.done ? "Marcar como pendiente" : "Marcar como completado"}
            style={styles.toggle}
          >
            <Icon
              name={goal.done ? "check" : "circle"}
              size={26}
              color={goal.done ? colors.success : colors.labelTertiary}
            />
          </Pressable>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt
              variant="headline"
              tone={goal.done ? "secondary" : "label"}
              style={goal.done ? { textDecorationLine: "line-through" } : undefined}
            >
              {goal.text}
            </Txt>
            {goal.target_value !== null ? (
              <Txt variant="subhead" tone="secondary" numeric>
                Valor objetivo: {goal.target_value}
              </Txt>
            ) : null}
            {goal.target_date !== null && days !== null ? (
              <Txt
                variant="subhead"
                tone={days < 0 && !goal.done ? "danger" : "secondary"}
                numeric
              >
                {goal.target_date} · {goal.done ? "completado" : countdownLabel(days)}
              </Txt>
            ) : null}
          </View>
          <Button title="Editar" variant="plain" size="compact" onPress={() => startEdit(goal)} />
        </View>
      </Card>
    );
  }

  return (
    <Screen>
      {!formOpen ? (
        <Button
          title="Nuevo evento"
          icon="plus"
          variant="filled"
          size="large"
          fullWidth
          onPress={() => setCreating(true)}
        />
      ) : null}

      {formOpen ? (
        <Card>
          <Txt variant="title3">{editingId !== null ? "Editar evento" : "Nuevo evento"}</Txt>
          <TextField
            placeholder="Título del evento"
            value={text}
            onChangeText={setText}
            accessibilityLabel="Título del evento"
          />
          <TextField
            placeholder="Valor objetivo (opcional)"
            keyboardType="decimal-pad"
            value={targetValue}
            onChangeText={setTargetValue}
            accessibilityLabel="Valor objetivo"
          />
          <PickerField mode="date" label="Fecha" value={targetDate} onChange={setTargetDate} />

          {formError ? (
            <Txt variant="subhead" tone="danger">
              {formError}
            </Txt>
          ) : null}

          <Button
            title={saving ? "Guardando..." : editingId !== null ? "Guardar cambios" : "Guardar evento"}
            variant="filled"
            size="large"
            fullWidth
            onPress={handleSave}
            disabled={saving}
          />
          <Button
            title={editingId !== null ? "Cancelar edición" : "Cancelar"}
            variant="plain"
            fullWidth
            onPress={resetForm}
            disabled={saving}
          />
          {editingId !== null ? (
            <Button
              title="Borrar evento"
              variant="destructive"
              fullWidth
              disabled={saving}
              onPress={() => {
                const goal = goals.find((g) => g.id === editingId);
                if (goal) confirmDelete(goal);
              }}
            />
          ) : null}
        </Card>
      ) : null}

      {actionError ? (
        <Txt variant="subhead" tone="danger">
          {actionError}
        </Txt>
      ) : null}

      {goals.length === 0 && !formOpen ? (
        <Card>
          <Txt variant="headline">Todavía no hay eventos</Txt>
          <Txt variant="subhead" tone="secondary">
            Apunta lo que viene (una competición, un peso para una fecha) y márcalo al cumplirlo.
          </Txt>
        </Card>
      ) : null}

      {pending.length > 0 ? (
        <View style={{ gap: space.md }}>
          <SectionHeader>{`Pendientes (${pending.length})`}</SectionHeader>
          {pending.map(renderGoal)}
        </View>
      ) : null}

      {done.length > 0 ? (
        <View style={{ gap: space.md }}>
          <SectionHeader>{`Completados (${done.length})`}</SectionHeader>
          {done.map(renderGoal)}
        </View>
      ) : null}
    </Screen>
  );
}

const useStyles = makeStyles(() => ({
  goalRow: { flexDirection: "row", alignItems: "center", gap: space.md },
  toggle: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -space.sm },
}));
