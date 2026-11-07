import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  ScrollViewInstance,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchExercises } from "../api/exercises";
import { createRoutine, deleteRoutine, fetchRoutines, updateRoutine } from "../api/routines";
import ExercisePickerList from "../components/ExercisePickerList";
import SheetHeader from "../components/SheetHeader";
import Button from "../components/ui/Button";
import FadeInView from "../components/ui/FadeInView";
import { Card } from "../components/ui/Card";
import Icon from "../components/ui/Icon";
import { ScreenError, ScreenLoading } from "../components/ui/Screen";
import TextField from "../components/ui/TextField";
import Txt from "../components/ui/Txt";
import { Exercise } from "../types/exercise";
import { Routine, RoutineExercise, RoutineExerciseCreate } from "../types/routine";
import { secondaryHint } from "../utils/exercisePicker";
import { groupBySuperset } from "../utils/superset";
import { showAlert } from "../utils/alert";
import { Text } from "../components/ui/compat";
import { makeStyles, radius, space, useTheme } from "../theme/theme";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; routines: Routine[]; exercises: Exercise[] };

// supersetGroup: null = fila suelta; mismo entero (local a este formulario,
// no es un id del backend) = misma super-serie. Ver comentario en
// confirmSuperset/removeRow sobre cómo se asignan/limpian estos ids.
type DraftRow = {
  id: number;
  exerciseId: number | null;
  sets: string;
  supersetGroup: number | null;
};

function makeEmptyRow(id: number): DraftRow {
  return { id, exerciseId: null, sets: "", supersetGroup: null };
}

export default function RoutinesScreen() {
  const styles = useStyles();
  const [state, setState] = useState<State>({ status: "loading" });
  const hasDataRef = useRef(false);

  const [name, setName] = useState("");
  const nextRowIdRef = useRef(1);
  const [rows, setRows] = useState<DraftRow[]>([makeEmptyRow(0)]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [pickerRowId, setPickerRowId] = useState<number | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const scrollRef = useRef<ScrollViewInstance>(null);

  // Contador de ids de bloque de super-serie, local a este formulario (no es
  // un id del backend -- el backend solo exige que el mismo entero se repita
  // entre los ejercicios de un mismo bloque dentro de esta rutina).
  const nextGroupIdRef = useRef(1);
  const [supersetPickerVisible, setSupersetPickerVisible] = useState(false);
  const [supersetSelection, setSupersetSelection] = useState<number[]>([]);
  const [supersetPickerQuery, setSupersetPickerQuery] = useState("");

  // null = formulario en modo "Nueva rutina"; si tiene un id, el formulario
  // está editando esa rutina existente (PUT en vez de POST al guardar).
  const [editingId, setEditingId] = useState<number | null>(null);
  // El formulario solo se muestra al crear (botón "Nueva rutina") o al editar.
  const [creating, setCreating] = useState(false);
  const formOpen = creating || editingId !== null;
  // Rutinas desplegadas (ids). Vacío = todas recogidas.
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const { colors } = useTheme();

  function toggleExpanded(id: number) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }
  // Error de acciones sobre la lista (borrar), separado de formError porque
  // no está atado al formulario de creación/edición.
  const [actionError, setActionError] = useState<string | null>(null);

  // El formulario puede quedar más alto que la pantalla; cuando el teclado
  // aparece, el "Guardar rutina" (al final) queda tapado si no se hace scroll.
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, []);

  const load = useCallback(() => {
    if (!hasDataRef.current) {
      setState({ status: "loading" });
    }

    Promise.all([fetchRoutines(), fetchExercises()])
      .then(([routines, exercises]) => {
        hasDataRef.current = true;
        setState({ status: "ready", routines, exercises });
      })
      .catch((error: Error) => {
        if (!hasDataRef.current) {
          setState({ status: "error", message: error.message });
        }
      });
  }, []);

  // Corre cada vez que la pestaña "Rutinas" gana foco (no solo al montar), para
  // que una rutina creada aquí y luego una vuelta desde otra pestaña se refleje.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    if (!formOpen) {
      return;
    }
    // El formulario vive al final del scroll: esperar a que se pinte y bajar.
    const id = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    return () => clearTimeout(id);
  }, [formOpen, editingId]);

  function appendCreatedExercise(exercise: Exercise) {
    setState((prev) => {
      if (prev.status !== "ready") {
        return prev;
      }
      if (prev.exercises.some((e) => e.id === exercise.id)) {
        return prev;
      }
      return { ...prev, exercises: [...prev.exercises, exercise] };
    });
  }

  function replaceUpdatedExercise(exercise: Exercise) {
    setState((prev) =>
      prev.status === "ready"
        ? {
            ...prev,
            exercises: prev.exercises.map((item) =>
              item.id === exercise.id ? exercise : item
            ),
          }
        : prev
    );
  }

  function updateRow(id: number, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  }

  function addRow() {
    const id = nextRowIdRef.current++;
    setRows((prev) => [...prev, makeEmptyRow(id)]);
  }

  // Si la fila borrada pertenecía a un bloque de super-serie, y solo queda 1
  // miembro de ese bloque tras borrarla, ese miembro se desagrupa solo
  // (supersetGroup: null) -- un bloque de 1 no tiene sentido y el backend lo
  // rechazaría igualmente.
  function removeRow(id: number) {
    setRows((prev) => {
      const removed = prev.find((row) => row.id === id);
      let next = prev.filter((row) => row.id !== id);

      if (removed?.supersetGroup != null) {
        const remaining = next.filter((row) => row.supersetGroup === removed.supersetGroup);
        if (remaining.length === 1) {
          next = next.map((row) =>
            row.id === remaining[0].id ? { ...row, supersetGroup: null } : row
          );
        }
      }

      return next;
    });
  }

  // Quita el bloque entero de una vez (todas sus filas). Si eso deja el
  // formulario sin ninguna fila, se repone una fila vacía -- el formulario
  // siempre debe tener al menos una.
  function removeGroup(groupId: number) {
    setRows((prev) => {
      const next = prev.filter((row) => row.supersetGroup !== groupId);
      return next.length > 0 ? next : [makeEmptyRow(nextRowIdRef.current++)];
    });
  }

  function selectExercise(rowId: number, exerciseId: number) {
    updateRow(rowId, { exerciseId });
    setPickerRowId(null);
  }

  function openExercisePicker(rowId: number) {
    setPickerQuery("");
    setPickerRowId(rowId);
  }

  function openSupersetPicker() {
    setSupersetSelection([]);
    setSupersetPickerQuery("");
    setSupersetPickerVisible(true);
  }

  function toggleSupersetExercise(id: number) {
    setSupersetSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  // Añade N filas nuevas (una por ejercicio elegido), todas con el mismo
  // supersetGroup nuevo. Cada una conserva su propio input de "Sets" -- no
  // se fuerza que sean iguales entre miembros del bloque.
  function confirmSuperset() {
    if (supersetSelection.length < 2) {
      return;
    }

    const groupId = nextGroupIdRef.current++;
    const newRows: DraftRow[] = supersetSelection.map((exerciseId) => ({
      id: nextRowIdRef.current++,
      exerciseId,
      sets: "",
      supersetGroup: groupId,
    }));

    setRows((prev) => [...prev, ...newRows]);
    setSupersetPickerVisible(false);
  }

  function resetForm() {
    setEditingId(null);
    setCreating(false);
    setName("");
    nextRowIdRef.current = 1;
    nextGroupIdRef.current = 1;
    setRows([makeEmptyRow(0)]);
    setFormError(null);
  }

  // Precarga el formulario con los datos de una rutina existente y lo pone en
  // modo edición. El formulario vive al final del ScrollView (debajo de la
  // lista), así que hacemos scrollToEnd para que el usuario vea el cambio
  // aunque tocara "Editar" en una tarjeta muy arriba.
  function startEdit(routine: Routine) {
    const sortedExercises = routine.exercises.slice().sort((a, b) => a.order - b.order);
    const newRows: DraftRow[] = sortedExercises.map((re, index) => ({
      id: index,
      exerciseId: re.exercise_id,
      sets: String(re.target_sets),
      supersetGroup: re.superset_group,
    }));

    nextRowIdRef.current = newRows.length;
    // Los ids de grupo que trae la rutina (superset_group) se reusan tal
    // cual como ids locales -- solo hay que asegurar que el próximo grupo
    // que se cree en este formulario (con "+ Super-serie") no choque con
    // ninguno ya cargado.
    const maxGroup = sortedExercises.reduce(
      (max, re) => (re.superset_group != null ? Math.max(max, re.superset_group) : max),
      0
    );
    nextGroupIdRef.current = maxGroup + 1;
    setEditingId(routine.id);
    setName(routine.name);
    setRows(newRows.length > 0 ? newRows : [makeEmptyRow(0)]);
    setFormError(null);
    scrollRef.current?.scrollToEnd({ animated: true });
  }

  function confirmDelete(routine: Routine) {
    showAlert("¿Borrar rutina?", `Se borrará "${routine.name}" permanentemente.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: () => handleDelete(routine.id),
      },
    ]);
  }

  async function handleDelete(id: number) {
    setActionError(null);
    try {
      await deleteRoutine(id);
      if (editingId === id) {
        resetForm();
      }
      load();
    } catch (error) {
      setActionError((error as Error).message);
    }
  }

  async function handleSave() {
    setFormError(null);

    if (!name.trim()) {
      setFormError("Ponle un nombre a la rutina.");
      return;
    }

    const exercises: RoutineExerciseCreate[] = [];
    let order = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const isUntouched = row.exerciseId === null && !row.sets.trim();
      if (isUntouched) {
        // Fila añadida pero nunca rellenada: se ignora en silencio, no es un error.
        continue;
      }

      if (row.exerciseId === null) {
        setFormError(`Falta elegir ejercicio en la fila ${i + 1}.`);
        return;
      }

      const sets = Number(row.sets);
      if (!Number.isInteger(sets) || sets <= 0) {
        setFormError(`Sets debe ser un número entero mayor que 0 en la fila ${i + 1}.`);
        return;
      }

      exercises.push({
        exercise_id: row.exerciseId,
        target_sets: sets,
        order: order++,
        superset_group: row.supersetGroup,
      });
    }

    if (exercises.length === 0) {
      setFormError("Añade al menos un ejercicio.");
      return;
    }

    setSaving(true);
    try {
      const payload = { name: name.trim(), exercises };
      if (editingId !== null) {
        await updateRoutine(editingId, payload);
      } else {
        await createRoutine(payload);
      }
      resetForm();
      load();
    } catch (error) {
      setFormError((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (state.status === "loading") {
    return <ScreenLoading />;
  }

  if (state.status === "error") {
    return <ScreenError message={state.message} />;
  }

  const { routines, exercises } = state;

  // Fila del formulario (picker de ejercicio + input de sets + "Quitar"),
  // reusada tanto para filas sueltas como para cada miembro de un bloque de
  // super-serie -- el JSX es idéntico en los dos casos, solo cambia si va
  // envuelta en el contenedor de bloque o no.
  function renderDraftRow(row: DraftRow) {
    const selectedExercise = exercises.find((e) => e.id === row.exerciseId);
    return (
      <View key={row.id} style={styles.draftRow}>
        <Pressable
          style={styles.pickerField}
          onPress={() => openExercisePicker(row.id)}
          accessibilityRole="button"
          accessibilityLabel="Elegir ejercicio"
        >
          <Txt
            variant="body"
            tone={selectedExercise ? "label" : "tertiary"}
            numberOfLines={1}
            style={{ flex: 1 }}
          >
            {selectedExercise?.name ?? "Elige un ejercicio"}
          </Txt>
          <Icon name="expand" size={13} color={colors.labelTertiary} />
        </Pressable>

        <TextField
          style={styles.setsField}
          placeholder="Series"
          keyboardType="number-pad"
          value={row.sets}
          onChangeText={(text) => updateRow(row.id, { sets: text })}
          accessibilityLabel="Número de series"
        />

        {rows.length > 1 ? (
          <Pressable
            onPress={() => removeRow(row.id)}
            accessibilityRole="button"
            accessibilityLabel="Quitar ejercicio"
            style={styles.removeButton}
          >
            <Icon name="remove" size={22} color={colors.labelSecondary} />
          </Pressable>
        ) : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >

          {!formOpen ? (
            <Button
              title="Nueva rutina"
              icon="plus"
              variant="filled"
              size="large"
              fullWidth
              onPress={() => setCreating(true)}
            />
          ) : null}

          {routines.length === 0 && !formOpen ? (
            <Card>
              <Txt variant="headline">Todavía no hay rutinas</Txt>
              <Txt variant="subhead" tone="secondary">
                Crea una rutina con sus ejercicios y series, y luego asígnala a un día en Semana.
              </Txt>
            </Card>
          ) : null}

          {actionError ? (
            <Txt variant="subhead" tone="danger">
              {actionError}
            </Txt>
          ) : null}

          {routines
            .filter((routine) => routine.id !== editingId)
            .map((routine) => {
            const isOpen = expandedIds.has(routine.id);
            const totalSets = routine.exercises.reduce((sum, re) => sum + re.target_sets, 0);
            const exerciseLine = (re: RoutineExercise) => {
              const exercise = exercises.find((e) => e.id === re.exercise_id);
              return (
                <View key={re.id} style={styles.exLine}>
                  <Txt variant="callout" style={{ flex: 1 }}>
                    {exercise?.name ?? `Ejercicio #${re.exercise_id}`}
                  </Txt>
                  <Txt variant="subhead" tone="secondary" numeric>
                    {re.target_sets} {re.target_sets === 1 ? "serie" : "series"}
                  </Txt>
                </View>
              );
            };

            return (
              <Card key={routine.id}>
                <Pressable
                  onPress={() => toggleExpanded(routine.id)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                  style={styles.cardHeader}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Txt variant="headline">{routine.name}</Txt>
                    <Txt variant="subhead" tone="secondary" numeric>
                      {routine.exercises.length} ejercicio{routine.exercises.length === 1 ? "" : "s"} ·{" "}
                      {totalSets} series
                    </Txt>
                  </View>
                  <Icon
                    name={isOpen ? "collapse" : "expand"}
                    size={14}
                    color={colors.labelSecondary}
                  />
                </Pressable>

                {isOpen ? (
                  <FadeInView style={{ gap: space.sm }}>
                    <View style={styles.exerciseList}>
                      {groupBySuperset(
                        routine.exercises.slice().sort((a, b) => a.order - b.order),
                        (re: RoutineExercise) => re.superset_group
                      ).map((entry) => {
                        if (entry.type === "single") {
                          return exerciseLine(entry.item);
                        }
                        return (
                          <View key={`group-${entry.groupId}`} style={styles.groupBlock}>
                            <View style={styles.tag}>
                              <Txt variant="caption" tone="tint" weight="700">
                                Super-serie
                              </Txt>
                            </View>
                            {entry.items.map((re) => exerciseLine(re))}
                          </View>
                        );
                      })}
                    </View>

                    <View style={styles.actions}>
                      <Button
                        title="Editar"
                        variant="tinted"
                        size="compact"
                        onPress={() => startEdit(routine)}
                      />
                      <Button
                        title="Borrar"
                        variant="plainDestructive"
                        size="compact"
                        onPress={() => confirmDelete(routine)}
                      />
                    </View>
                  </FadeInView>
                ) : null}
              </Card>
            );
            })}

          {formOpen ? (
            <Card>
              <Txt variant="title3">{editingId !== null ? "Editar rutina" : "Nueva rutina"}</Txt>

              <TextField
                placeholder="Nombre de la rutina"
                value={name}
                onChangeText={setName}
                accessibilityLabel="Nombre de la rutina"
              />

              {groupBySuperset(rows, (row) => row.supersetGroup).map((entry) => {
                if (entry.type === "single") {
                  return renderDraftRow(entry.item);
                }

                return (
                  <View key={`group-${entry.groupId}`} style={styles.groupBlock}>
                    <View style={styles.groupHeader}>
                      <View style={styles.tag}>
                        <Txt variant="caption" tone="tint" weight="700">
                          Super-serie
                        </Txt>
                      </View>
                      <Button
                        title="Quitar bloque"
                        variant="plainDestructive"
                        size="compact"
                        onPress={() => removeGroup(entry.groupId)}
                      />
                    </View>
                    {entry.items.map((row) => renderDraftRow(row))}
                  </View>
                );
              })}

              <View style={styles.addButtons}>
                <View style={{ flex: 1 }}>
                  <Button title="Ejercicio" icon="plus" variant="tinted" fullWidth onPress={addRow} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Super-serie"
                    icon="plus"
                    variant="tinted"
                    fullWidth
                    onPress={openSupersetPicker}
                  />
                </View>
              </View>

              {formError ? (
                <Txt variant="subhead" tone="danger">
                  {formError}
                </Txt>
              ) : null}

              <Button
                title={
                  saving ? "Guardando..." : editingId !== null ? "Guardar cambios" : "Guardar rutina"
                }
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
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={pickerRowId !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerRowId(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setPickerRowId(null)}>
          {/* Este Modal se renderiza fuera del navigator de tabs, así que no
              lleva useBottomTabBarHeight() como offset (eso es correcto para
              el KeyboardAvoidingView de la pantalla normal más arriba, que sí
              está montado dentro del navigator) -- aquí la tarjeta no tiene
              nada por encima que compensar, así que offset 0 le basta. */}
          <KeyboardAvoidingView
            style={styles.avoider}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={0}
          >
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <SheetHeader title="Elige un ejercicio" onClose={() => setPickerRowId(null)} />

              <ExercisePickerList
                exercises={exercises}
                query={pickerQuery}
                onQueryChange={setPickerQuery}
                onCreated={appendCreatedExercise}
                onUpdated={replaceUpdatedExercise}
                renderItem={(exercise) => {
                  const hint = secondaryHint(exercise);
                  return (
                    <TouchableOpacity
                      style={styles.option}
                      onPress={() => pickerRowId !== null && selectExercise(pickerRowId, exercise.id)}
                    >
                      <Text style={styles.optionText}>{exercise.name}</Text>
                      {hint && <Text style={styles.optionHint}>{hint}</Text>}
                    </TouchableOpacity>
                  );
                }}
              />

              <TouchableOpacity style={styles.cancelButton} onPress={() => setPickerRowId(null)}>
                <Text style={styles.cancelText}>Cancelar</Text>
              </TouchableOpacity>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Picker de multi-selección para armar un bloque de super-serie --
          distinto del modal de arriba, que elige un solo ejercicio para una
          fila concreta. Mismo estilo visual (sin cerrar al tocar fuera),
          consistente con el resto de esta pantalla. */}
      <Modal
        visible={supersetPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSupersetPickerVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setSupersetPickerVisible(false)}>
          <KeyboardAvoidingView
            style={styles.avoider}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={0}
          >
            <Pressable style={styles.modalCard} onPress={() => {}}>
              <SheetHeader
                title="Elige ejercicios para la super-serie"
                onClose={() => setSupersetPickerVisible(false)}
              />

              <ExercisePickerList
                exercises={exercises}
                query={supersetPickerQuery}
                onQueryChange={setSupersetPickerQuery}
                onCreated={appendCreatedExercise}
                onUpdated={replaceUpdatedExercise}
                renderItem={(exercise) => {
                  const selected = supersetSelection.includes(exercise.id);
                  const hint = secondaryHint(exercise);
                  return (
                    <TouchableOpacity
                      style={styles.option}
                      onPress={() => toggleSupersetExercise(exercise.id)}
                    >
                      <Text style={selected ? styles.optionTextSelected : styles.optionText}>
                        {selected ? "✓ " : ""}
                        {exercise.name}
                      </Text>
                      {hint && <Text style={styles.optionHint}>{hint}</Text>}
                    </TouchableOpacity>
                  );
                }}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.supersetCancelButton}
                  onPress={() => setSupersetPickerVisible(false)}
                >
                  <Text style={styles.cancelText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.doneButton}
                  onPress={confirmSuperset}
                  disabled={supersetSelection.length < 2}
                >
                  <Text
                    style={supersetSelection.length < 2 ? styles.doneTextDisabled : styles.doneText}
                  >
                    Listo ({supersetSelection.length})
                  </Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  cardHeader: { flexDirection: "row", alignItems: "center", gap: space.sm },
  exerciseList: { gap: space.sm, paddingTop: space.xs },
  exLine: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  // Los miembros de una super-serie van sangrados con una línea fina a la izquierda.
  groupBlock: {
    gap: space.sm,
    paddingLeft: space.md,
    borderLeftWidth: 1,
    borderLeftColor: colors.separator,
  },
  groupHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tag: {
    alignSelf: "flex-start",
    paddingVertical: 3,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.tintSoft,
  },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: space.sm },
  draftRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  pickerField: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.control,
    borderCurve: "continuous",
    backgroundColor: colors.surfaceInset,
  },
  setsField: { width: 76, textAlign: "center" },
  removeButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  addButtons: { flexDirection: "row", gap: space.sm },
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    padding: space.lg,
    paddingBottom: space.xxxl * 2,
    gap: space.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: colors.labelSecondary,
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  routineName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 4,
  },
  exerciseLine: {
    fontSize: 15,
    color: colors.label,
    marginVertical: 2,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
    marginTop: 8,
  },
  // Contenedor visual para un bloque de super-serie dentro de la lista de
  // rutinas ya creadas (modo solo lectura) -- mismo espíritu que
  // supersetGroupBox del formulario, pero sin acciones.
  supersetGroupBoxReadOnly: {
    borderWidth: 1,
    borderColor: colors.tint,
    borderRadius: 6,
    padding: 8,
    marginVertical: 4,
  },
  supersetGroupBox: {
    borderWidth: 1,
    borderColor: colors.tint,
    borderRadius: 6,
    padding: 8,
    marginBottom: 8,
  },
  supersetGroupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  supersetGroupLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.tint,
    textTransform: "uppercase",
  },
  formButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
  },
  formCard: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.separator,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  row: {
    marginBottom: 8,
  },
  pickerButton: {
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 6,
    padding: 10,
    marginBottom: 4,
  },
  pickerButtonText: {
    fontSize: 16,
    color: colors.label,
  },
  pickerPlaceholderText: {
    fontSize: 16,
    color: colors.labelTertiary,
  },
  numberInput: {
    borderWidth: 1,
    borderColor: colors.separator,
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    marginBottom: 4,
  },
  saveButton: {
    marginTop: 12,
  },
  cancelEditButton: {
    marginTop: 8,
  },
  errorDetail: {
    fontSize: 14,
    color: colors.danger,
    marginTop: 8,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  // El tope de altura vive aquí, no en modalCard: un maxHeight en % solo se
  // resuelve si el padre tiene una altura definida, y modalBackdrop (flex: 1
  // dentro de un Modal a pantalla completa) sí la tiene -- KeyboardAvoidingView
  // es ese padre directo. Antes el 70% estaba en modalCard, cuyo padre
  // (KeyboardAvoidingView sin estilo propio) no tiene altura definida, así
  // que el límite nunca se aplicaba de verdad: la tarjeta crecía tanto como
  // su contenido (todos los ejercicios) y lo que no cabía en pantalla
  // quedaba cortado por el borde, no accesible con scroll.
  // (92% y no 70%: con el teclado abierto KeyboardAvoidingView resta su altura de
  // este tope; con 70% no quedaba sitio para los resultados del buscador.)
  avoider: {
    maxHeight: "92%",
  },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    flexShrink: 1,
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
    borderBottomColor: colors.separator,
  },
  optionText: {
    fontSize: 16,
    textAlign: "left",
  },
  optionTextSelected: {
    fontSize: 16,
    textAlign: "left",
    fontWeight: "600",
    color: colors.success,
  },
  optionHint: {
    fontSize: 12,
    color: colors.labelTertiary,
    textAlign: "left",
    marginTop: 2,
  },
  cancelButton: {
    paddingVertical: 14,
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
    textAlign: "center",
    color: colors.danger,
    fontWeight: "600",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  supersetCancelButton: {
    flex: 1,
    paddingVertical: 14,
  },
  doneButton: {
    flex: 1,
    paddingVertical: 14,
  },
  doneText: {
    fontSize: 16,
    textAlign: "center",
    color: colors.success,
    fontWeight: "600",
  },
  doneTextDisabled: {
    fontSize: 16,
    textAlign: "center",
    color: colors.labelTertiary,
    fontWeight: "600",
  },
}));
