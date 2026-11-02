import { ReactNode, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View } from "react-native";

import { createExercise, updateExercise } from "../api/exercises";
import { makeStyles, space } from "../theme/theme";
import { Exercise, WeightUnit } from "../types/exercise";
import { MUSCLE_GROUP_ORDER, filterExercises, groupExercisesByMuscle } from "../utils/exercisePicker";
import Button from "./ui/Button";
import Chip from "./ui/Chip";
import TextField from "./ui/TextField";
import Txt from "./ui/Txt";

type Props = {
  exercises: Exercise[];
  query: string;
  onQueryChange: (text: string) => void;
  // Cómo se renderiza una fila concreta -- el <TouchableOpacity> con su
  // estilo/onPress/estado seleccionado sigue siendo responsabilidad de cada
  // pantalla (single-select en Rutinas, multi-select con checkmarks en los
  // pickers de super-serie), este componente solo decide QUÉ ejercicios se
  // muestran y en qué sección, no cómo reacciona el toque.
  renderItem: (exercise: Exercise) => ReactNode;
  // Tras un POST /exercises 201. El padre mete el ejercicio en su lista para
  // que el otro picker de la misma pantalla (si hay dos) también lo vea.
  onCreated?: (exercise: Exercise) => void;
  onUpdated?: (exercise: Exercise) => void;
};

function emptyForm() {
  return {
    name: "",
    unit: "kg" as WeightUnit,
    primary: "" as string,
    secondary: [] as string[],
  };
}

function formFromExercise(exercise: Exercise) {
  return {
    name: exercise.name,
    unit: exercise.unit,
    primary: exercise.muscle_group_primary ?? "",
    secondary: exercise.muscle_group_secondary ?? [],
  };
}

const UNITS: [WeightUnit, string][] = [
  ["kg", "kg"],
  ["lb", "lb"],
  ["bw", "PC"],
];

const useStyles = makeStyles(({ colors }) => ({
  // flexShrink: 1 es necesario explícitamente -- a diferencia de la web, el
  // valor por defecto de Yoga (el motor de layout de RN) es flexShrink: 0.
  // Sin esto, este ScrollView no respeta la altura acotada que le da el
  // contenedor del modal (ver comentario "avoider" en cada pantalla que usa
  // este componente) y el sobrante queda cortado en vez de poder desplazarse.
  list: { flexShrink: 1 },
  sectionHeader: { marginTop: space.md, marginBottom: space.xs },
  exerciseRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  exerciseSelection: { flex: 1 },
  topActions: { gap: space.sm, marginBottom: space.sm },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  avoider: { maxHeight: "92%" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: space.md,
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl,
    gap: space.md,
    flexShrink: 1,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.labelTertiary,
  },
  formScroll: { flexShrink: 1 },
  formContent: { gap: space.md, paddingBottom: space.sm },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  chipRow: { flexDirection: "row", gap: space.sm },
  // Los botones van FUERA del scroll para que "Guardar" esté siempre a la vista,
  // aunque haya que desplazar el formulario o esté el teclado abierto.
  actions: { flexDirection: "row", gap: space.md },
}));

// Buscador + agrupación por músculo principal, compartido entre los modales
// de selección de ejercicio. "Nuevo ejercicio" y "Editar" abren una hoja propia
// con el formulario y los botones fijos abajo (antes el formulario salía arriba
// de la lista, fuera de vista al editar un ejercicio lejano, y "Guardar" era un
// enlace pequeño al final de un formulario largo).
export default function ExercisePickerList({
  exercises,
  query,
  onQueryChange,
  renderItem,
  onCreated,
  onUpdated,
}: Props) {
  const styles = useStyles();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const filtered = filterExercises(exercises, query);
  const groups = groupExercisesByMuscle(filtered);

  function openCreate() {
    setFormError(null);
    setForm(emptyForm());
    setEditingId(null);
    setFormOpen(true);
  }

  function openEdit(exercise: Exercise) {
    setFormError(null);
    setForm(formFromExercise(exercise));
    setEditingId(exercise.id);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
    setFormError(null);
    setForm(emptyForm());
  }

  function toggleSecondary(group: string) {
    setForm((prev) => ({
      ...prev,
      secondary: prev.secondary.includes(group)
        ? prev.secondary.filter((g) => g !== group)
        : [...prev.secondary, group],
    }));
  }

  function handleSave() {
    const name = form.name.trim();
    if (!name) {
      setFormError("Ponle un nombre al ejercicio.");
      return;
    }
    if (!form.primary) {
      setFormError("Elige un grupo muscular principal.");
      return;
    }

    setSaving(true);
    setFormError(null);
    const payload = {
      name,
      unit: form.unit,
      muscle_group_primary: form.primary,
      muscle_group_secondary: form.secondary.filter((g) => g !== form.primary),
    };
    const request =
      editingId === null ? createExercise(payload) : updateExercise(editingId, payload);

    request
      .then((exercise) => {
        const wasCreate = editingId === null;
        closeForm();
        onQueryChange("");
        if (wasCreate) {
          onCreated?.(exercise);
        } else {
          onUpdated?.(exercise);
        }
      })
      .catch((error: Error) => {
        setFormError(error.message);
      })
      .finally(() => {
        setSaving(false);
      });
  }

  return (
    <>
      <View style={styles.topActions}>
        <TextField
          placeholder="Buscar por nombre o músculo..."
          value={query}
          onChangeText={onQueryChange}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Buscar ejercicio"
        />
        <Button title="Nuevo ejercicio" icon="plus" variant="tinted" fullWidth onPress={openCreate} />
      </View>

      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {groups.length === 0 ? (
          <Txt variant="subhead" tone="secondary" style={{ textAlign: "center", marginTop: space.md }}>
            Sin resultados.
          </Txt>
        ) : null}

        {groups.map((group) => (
          <View key={group.label}>
            <View style={styles.sectionHeader}>
              <Txt variant="footnote" tone="secondary" weight="600">
                {group.label}
              </Txt>
            </View>
            {group.exercises.map((exercise) => (
              <View key={exercise.id} style={styles.exerciseRow}>
                <View style={styles.exerciseSelection}>{renderItem(exercise)}</View>
                <Button
                  title="Editar"
                  variant="plain"
                  size="compact"
                  onPress={() => openEdit(exercise)}
                />
              </View>
            ))}
          </View>
        ))}
      </ScrollView>

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={closeForm}>
        <View style={styles.backdrop}>
          <KeyboardAvoidingView
            style={styles.avoider}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={0}
          >
            <View style={styles.sheet}>
              <View style={styles.grabber} />
              <Txt variant="title3" style={{ textAlign: "center" }}>
                {editingId === null ? "Nuevo ejercicio" : "Editar ejercicio"}
              </Txt>

              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled"
              >
                <TextField
                  placeholder="Nombre"
                  value={form.name}
                  onChangeText={(name) => setForm((prev) => ({ ...prev, name }))}
                  autoCapitalize="sentences"
                  editable={!saving}
                  accessibilityLabel="Nombre del ejercicio"
                />

                <Txt variant="footnote" tone="secondary" weight="600">
                  Unidad
                </Txt>
                <View style={styles.chipRow}>
                  {UNITS.map(([value, label]) => (
                    <Chip
                      key={value}
                      label={label}
                      selected={form.unit === value}
                      disabled={saving}
                      onPress={() => setForm((prev) => ({ ...prev, unit: value }))}
                    />
                  ))}
                </View>

                <Txt variant="footnote" tone="secondary" weight="600">
                  Grupo principal
                </Txt>
                <View style={styles.chipWrap}>
                  {MUSCLE_GROUP_ORDER.map((group) => (
                    <Chip
                      key={group}
                      label={group}
                      selected={form.primary === group}
                      disabled={saving}
                      onPress={() =>
                        setForm((prev) => ({
                          ...prev,
                          primary: group,
                          secondary: prev.secondary.filter((g) => g !== group),
                        }))
                      }
                    />
                  ))}
                </View>

                <Txt variant="footnote" tone="secondary" weight="600">
                  Secundarios (opcional)
                </Txt>
                <View style={styles.chipWrap}>
                  {MUSCLE_GROUP_ORDER.filter((g) => g !== form.primary).map((group) => (
                    <Chip
                      key={group}
                      label={group}
                      selected={form.secondary.includes(group)}
                      disabled={saving}
                      onPress={() => toggleSecondary(group)}
                    />
                  ))}
                </View>

                {formError ? (
                  <Txt variant="subhead" tone="danger">
                    {formError}
                  </Txt>
                ) : null}
              </ScrollView>

              <View style={styles.actions}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Cancelar"
                    variant="tinted"
                    size="large"
                    fullWidth
                    disabled={saving}
                    onPress={closeForm}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title={saving ? "Guardando..." : editingId === null ? "Guardar" : "Guardar cambios"}
                    variant="filled"
                    size="large"
                    fullWidth
                    disabled={saving}
                    onPress={handleSave}
                  />
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}
