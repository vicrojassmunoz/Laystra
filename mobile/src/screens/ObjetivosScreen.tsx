import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import { Pressable, View } from "react-native";

import { createGoal, deleteGoal, fetchGoals, updateGoal } from "../api/goals";
import { todayIsoDate } from "../api/today";
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
  const styles = useStyles();
  const { colors } = useTheme();
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
  // El formulario solo se muestra al crear (botón "Nuevo objetivo") o al editar.
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
    showAlert("¿Borrar objetivo?", `Se borrará "${goal.text}" permanentemente.`, [
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
    return <ScreenLoading />;
  }
  if (state.status === "error") {
    return <ScreenError message={state.message} />;
  }

  const { goals } = state;
  const pending = goals.filter((g) => !g.done);
  const done = goals.filter((g) => g.done);
  const today = todayIsoDate();

  // "en 12 días" / "hoy" / "hace 3 días": solo informativo, junto a la fecha.
  function dueLabel(iso: string): { text: string; overdue: boolean } {
    const [y, m, d] = iso.split("-").map(Number);
    const [ty, tm, td] = today.split("-").map(Number);
    const days = Math.round(
      (new Date(y, m - 1, d).getTime() - new Date(ty, tm - 1, td).getTime()) / 86400000
    );
    if (days === 0) return { text: "vence hoy", overdue: false };
    if (days > 0) return { text: `en ${days} día${days === 1 ? "" : "s"}`, overdue: false };
    return { text: `venció hace ${-days} día${days === -1 ? "" : "s"}`, overdue: true };
  }

  function renderGoal(goal: Goal) {
    const due = goal.target_date ? dueLabel(goal.target_date) : null;
    return (
      <Card key={goal.id}>
        <View style={styles.goalRow}>
          <Pressable
            onPress={() => toggleDone(goal)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: goal.done }}
            accessibilityLabel={goal.done ? "Marcar como pendiente" : "Marcar como cumplido"}
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
                Objetivo: {goal.target_value}
              </Txt>
            ) : null}
            {goal.target_date !== null && due ? (
              <Txt
                variant="subhead"
                tone={due.overdue && !goal.done ? "danger" : "secondary"}
                numeric
              >
                {goal.target_date} · {goal.done ? "cumplido" : due.text}
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
          title="Nuevo objetivo"
          icon="plus"
          variant="filled"
          size="large"
          fullWidth
          onPress={() => setCreating(true)}
        />
      ) : null}

      {formOpen ? (
        <Card>
          <Txt variant="title3">{editingId !== null ? "Editar objetivo" : "Nuevo objetivo"}</Txt>
          <TextField
            placeholder="Texto del objetivo"
            value={text}
            onChangeText={setText}
            accessibilityLabel="Texto del objetivo"
          />
          <TextField
            placeholder="Valor objetivo (opcional)"
            keyboardType="decimal-pad"
            value={targetValue}
            onChangeText={setTargetValue}
            accessibilityLabel="Valor objetivo"
          />
          <TextField
            placeholder="Fecha AAAA-MM-DD (opcional)"
            value={targetDate}
            onChangeText={setTargetDate}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Fecha objetivo"
          />

          {formError ? (
            <Txt variant="subhead" tone="danger">
              {formError}
            </Txt>
          ) : null}

          <Button
            title={saving ? "Guardando..." : editingId !== null ? "Guardar cambios" : "Guardar objetivo"}
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
              title="Borrar objetivo"
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
          <Txt variant="headline">Todavía no hay objetivos</Txt>
          <Txt variant="subhead" tone="secondary">
            Apunta lo que quieres conseguir (un peso, una marca, una fecha) y márcalo cuando lo
            cumplas.
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
          <SectionHeader>{`Cumplidos (${done.length})`}</SectionHeader>
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
