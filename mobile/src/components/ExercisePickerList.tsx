import { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { Exercise } from "../types/exercise";
import { filterExercises, groupExercisesByMuscle } from "../utils/exercisePicker";

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
};

// Buscador + agrupación por músculo principal, compartido entre los cuatro
// modales de selección de ejercicio de la app (picker suelto y picker de
// super-serie en RoutinesScreen, picker de entreno libre y su propio picker
// de super-serie en TodayScreen) -- centraliza el filtrado/agrupación aquí
// mismo que se extrajo SupersetBlock como componente compartido: evitar que
// la misma lógica se duplique en varios sitios y diverja con el tiempo.
export default function ExercisePickerList({ exercises, query, onQueryChange, renderItem }: Props) {
  const filtered = filterExercises(exercises, query);
  const groups = groupExercisesByMuscle(filtered);

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

      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
        {groups.length === 0 && <Text style={styles.emptyText}>Sin resultados.</Text>}

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
});
