import { Button, StyleSheet, Text, TextInput, View } from "react-native";

// Forma compartida de una fila de serie editable -- misma forma que
// `SetDraft` en TodayScreen y `EditSetDraft` en HistorialScreen (que ahora
// son alias de este tipo, ver comentarios en esas pantallas). Vive aquí
// porque este es el único sitio que la necesita en su forma "cruda" (id +
// weight/reps como string, antes de validar/convertir a número).
export type SetDraft = {
  id: number;
  weight: string;
  reps: string;
};

export type SupersetBlockMember = {
  key: string;
  name: string;
  unit: string;
  sets: SetDraft[];
};

type Props = {
  members: SupersetBlockMember[];
  disabled: boolean;
  onChangeSet: (memberIndex: number, roundIndex: number, patch: Partial<SetDraft>) => void;
  onAddRound: () => void;
  onRemoveRound: (roundIndex: number) => void;
};

// Renderiza un bloque de super-serie como "rondas intercaladas": una ronda
// es una posición de serie compartida por todos los miembros del bloque
// (ronda 1 = primera serie de cada ejercicio del bloque, ronda 2 = segunda,
// etc.), en vez de una tarjeta por ejercicio como los ejercicios sueltos.
// "+ añadir ronda" añade una fila a TODOS los miembros a la vez -- por eso
// las callbacks (onAddRound/onRemoveRound) no reciben qué miembro, solo el
// caller (TodayScreen/HistorialScreen) sabe qué índices de fila del
// formulario corresponden a este bloque y los sincroniza.
//
// Los miembros de un bloque pueden partir con distinto número de series
// (una rutina no fuerza que target_sets sea igual entre ellos), así que el
// número de rondas se calcula como el máximo entre miembros -- una ronda
// "corta" para un miembro simplemente no muestra fila para ese miembro en
// esa ronda, en vez de forzar series de más que no se han hecho.
export default function SupersetBlock({
  members,
  disabled,
  onChangeSet,
  onAddRound,
  onRemoveRound,
}: Props) {
  const roundCount = members.reduce((max, m) => Math.max(max, m.sets.length), 0);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Super-serie</Text>

      {Array.from({ length: roundCount }, (_, roundIndex) => {
        // Key estable por ronda: combina los ids (estables, de SetDraft) de
        // las filas presentes en esta ronda en vez del índice posicional --
        // si no, al quitar una ronda intermedia React podía reutilizar el
        // mismo TextInput enfocado para el valor de otra ronda, aunque el
        // valor mostrado siguiera siendo correcto (input controlado). Mismo
        // motivo por el que TodayScreen ya da un id estable a cada SetDraft.
        const roundKey = members
          .map((m) => m.sets[roundIndex]?.id ?? "x")
          .join("-");

        return (
          <View key={roundKey} style={styles.round}>
            <View style={styles.roundHeader}>
              <Text style={styles.roundTitle}>Ronda {roundIndex + 1}</Text>
              {!disabled && (
                <Button
                  title="Quitar ronda"
                  color="#b00020"
                  onPress={() => onRemoveRound(roundIndex)}
                />
              )}
            </View>

            {members.map((member, memberIndex) => {
              const setDraft = member.sets[roundIndex];
              if (!setDraft) {
                return null;
              }

              return (
                <View key={member.key} style={styles.setRow}>
                  <Text style={styles.exerciseLabel} numberOfLines={1}>
                    {member.name}
                  </Text>
                  <TextInput
                    style={styles.weightInput}
                    placeholder={member.unit}
                    keyboardType="decimal-pad"
                    value={setDraft.weight}
                    editable={!disabled}
                    onChangeText={(text) => onChangeSet(memberIndex, roundIndex, { weight: text })}
                  />
                  <TextInput
                    style={styles.repsInput}
                    placeholder="reps"
                    keyboardType="number-pad"
                    value={setDraft.reps}
                    editable={!disabled}
                    onChangeText={(text) => onChangeSet(memberIndex, roundIndex, { reps: text })}
                  />
                </View>
              );
            })}
          </View>
        );
      })}

      {!disabled && (
        <View style={styles.addRoundButton}>
          <Button title="+ añadir ronda" onPress={onAddRound} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#f4f4f4",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#8ab4f8",
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#3b5bdb",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  round: {
    marginBottom: 10,
  },
  roundHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  roundTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
    gap: 8,
  },
  exerciseLabel: {
    fontSize: 14,
    color: "#333",
    width: 96,
  },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  repsInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  addRoundButton: {
    marginTop: 4,
  },
});
