import { ReactNode, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { createExercise } from "../api/exercises";
import { Exercise } from "../types/exercise";
import { MUSCLE_GROUP_ORDER, filterExercises, groupExercisesByMuscle } from "../utils/exercisePicker";

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
};

function emptyCreateForm() {
  return {
    name: "",
    unit: "kg" as "kg" | "lb",
    primary: "" as string,
    secondary: [] as string[],
  };
}

// Buscador + agrupación por músculo principal, compartido entre los modales
// de selección de ejercicio. "+ Nuevo ejercicio" vive aquí para no duplicar
// el formulario en cada pantalla que abre un picker.
export default function ExercisePickerList({
  exercises,
  query,
  onQueryChange,
  renderItem,
  onCreated,
}: Props) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(emptyCreateForm);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const filtered = filterExercises(exercises, query);
  const groups = groupExercisesByMuscle(filtered);

  function toggleSecondary(group: string) {
    setForm((prev) => ({
      ...prev,
      secondary: prev.secondary.includes(group)
        ? prev.secondary.filter((g) => g !== group)
        : [...prev.secondary, group],
    }));
  }

  function handleCreate() {
    const name = form.name.trim();
    if (!name) {
      setCreateError("Ponle un nombre al ejercicio.");
      return;
    }
    if (!form.primary) {
      setCreateError("Elige un grupo muscular principal.");
      return;
    }

    setSaving(true);
    setCreateError(null);
    createExercise({
      name,
      unit: form.unit,
      muscle_group_primary: form.primary,
      muscle_group_secondary: form.secondary.filter((g) => g !== form.primary),
    })
      .then((exercise) => {
        setCreating(false);
        setForm(emptyCreateForm());
        onQueryChange("");
        onCreated?.(exercise);
      })
      .catch((error: Error) => {
        setCreateError(error.message);
      })
      .finally(() => {
        setSaving(false);
      });
  }

  return (
    <>
      <TextInput
        style={styles.searchInput}
        placeholder="Buscar por nombre o músculo..."
        value={query}
        onChangeText={onQueryChange}
        autoCapitalize="none"
        autoCorrect={false}
      />

      {!creating && (
        <TouchableOpacity
          style={styles.newButton}
          onPress={() => {
            setCreateError(null);
            setForm(emptyCreateForm());
            setCreating(true);
          }}
        >
          <Text style={styles.newButtonText}>+ Nuevo ejercicio</Text>
        </TouchableOpacity>
      )}

      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {creating && (
          <View style={styles.createForm}>
            <TextInput
              style={styles.searchInput}
              placeholder="Nombre"
              value={form.name}
              onChangeText={(name) => setForm((prev) => ({ ...prev, name }))}
              autoCapitalize="sentences"
              editable={!saving}
            />

            <View style={styles.unitRow}>
              <TouchableOpacity
                style={[styles.chip, form.unit === "kg" && styles.chipSelected]}
                onPress={() => setForm((prev) => ({ ...prev, unit: "kg" }))}
                disabled={saving}
              >
                <Text style={form.unit === "kg" ? styles.chipTextSelected : styles.chipText}>kg</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, form.unit === "lb" && styles.chipSelected]}
                onPress={() => setForm((prev) => ({ ...prev, unit: "lb" }))}
                disabled={saving}
              >
                <Text style={form.unit === "lb" ? styles.chipTextSelected : styles.chipText}>lb</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Grupo principal</Text>
            <View style={styles.chipWrap}>
              {MUSCLE_GROUP_ORDER.map((group) => {
                const selected = form.primary === group;
                return (
                  <TouchableOpacity
                    key={group}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() =>
                      setForm((prev) => ({
                        ...prev,
                        primary: group,
                        secondary: prev.secondary.filter((g) => g !== group),
                      }))
                    }
                    disabled={saving}
                  >
                    <Text style={selected ? styles.chipTextSelected : styles.chipText}>{group}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.fieldLabel}>Secundarios (opcional)</Text>
            <View style={styles.chipWrap}>
              {MUSCLE_GROUP_ORDER.filter((g) => g !== form.primary).map((group) => {
                const selected = form.secondary.includes(group);
                return (
                  <TouchableOpacity
                    key={group}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => toggleSecondary(group)}
                    disabled={saving}
                  >
                    <Text style={selected ? styles.chipTextSelected : styles.chipText}>{group}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {createError && <Text style={styles.createError}>{createError}</Text>}

            <View style={styles.createActions}>
              {saving ? (
                <ActivityIndicator />
              ) : (
                <>
                  <TouchableOpacity
                    onPress={() => {
                      setCreating(false);
                      setCreateError(null);
                      setForm(emptyCreateForm());
                    }}
                  >
                    <Text style={styles.cancelCreate}>Cancelar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleCreate}>
                    <Text style={styles.saveCreate}>Guardar</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        )}

        {groups.length === 0 && !creating && <Text style={styles.emptyText}>Sin resultados.</Text>}

        {groups.map((group) => (
          <View key={group.label}>
            <Text style={styles.sectionHeader}>{group.label}</Text>
            {group.exercises.map((exercise) => (
              <View key={exercise.id}>{renderItem(exercise)}</View>
            ))}
          </View>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  searchInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
    marginBottom: 8,
  },
  // flexShrink: 1 es necesario explícitamente -- a diferencia de la web, el
  // valor por defecto de Yoga (el motor de layout de RN) es flexShrink: 0.
  // Sin esto, este ScrollView no respeta la altura acotada que le da el
  // contenedor del modal (ver comentario "avoider" en cada pantalla que usa
  // este componente): en vez de convertirse en una ventana con scroll real,
  // crece tanto como su contenido (todos los ejercicios) y el sobrante queda
  // cortado por el borde de la pantalla en vez de poder desplazarse hasta él.
  list: {
    flexShrink: 1,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: "700",
    color: "#3b5bdb",
    textTransform: "uppercase",
    marginTop: 10,
    marginBottom: 2,
  },
  emptyText: {
    fontSize: 15,
    color: "#777",
    textAlign: "center",
    paddingVertical: 16,
  },
  newButton: {
    paddingVertical: 8,
    marginBottom: 4,
  },
  newButtonText: {
    fontSize: 16,
    color: "#3b5bdb",
    fontWeight: "600",
  },
  createForm: {
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#555",
    marginBottom: 6,
    marginTop: 4,
  },
  unitRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipSelected: {
    borderColor: "#3b5bdb",
    backgroundColor: "#3b5bdb",
  },
  chipText: {
    fontSize: 13,
    color: "#333",
  },
  chipTextSelected: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "600",
  },
  createError: {
    color: "#b00020",
    fontSize: 14,
    marginBottom: 8,
  },
  createActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  cancelCreate: {
    fontSize: 16,
    color: "#666",
  },
  saveCreate: {
    fontSize: 16,
    color: "#3b5bdb",
    fontWeight: "600",
  },
});
