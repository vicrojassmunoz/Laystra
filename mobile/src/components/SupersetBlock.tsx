import { Pressable, View } from "react-native";

import { makeStyles, radius, space, useTheme } from "../theme/theme";
import { WeightUnit } from "../types/exercise";
import { NO_PR, PrFlags } from "../utils/pr";
import SetRow from "./SetRow";
import Button from "./ui/Button";
import { Card } from "./ui/Card";
import Icon from "./ui/Icon";
import Txt from "./ui/Txt";
import { WeightUnitChips } from "./WeightUnitChips";

// Forma compartida de una fila de serie editable -- misma forma que
// `SetDraft` en SesionScreen y `EditSetDraft` en HistorialScreen (que son alias
// de este tipo). Vive aquí porque este es el único sitio que la necesita en su
// forma "cruda" (id + weight/reps como string, antes de validar/convertir).
export type SetDraft = {
  id: number;
  weight: string;
  reps: string;
};

export type SupersetBlockMember = {
  key: string;
  // exercise_id real del ejercicio (no la key de fila).
  exerciseId: number;
  name: string;
  unit: WeightUnit;
  sets: SetDraft[];
};

type Props = {
  members: SupersetBlockMember[];
  disabled: boolean;
  onChangeSet: (memberIndex: number, roundIndex: number, patch: Partial<SetDraft>) => void;
  onAddRound: () => void;
  onRemoveRound: (roundIndex: number) => void;
  onChangeUnit?: (memberIndex: number, unit: WeightUnit) => void;
  latestBodyWeight?: number | null;
  // set.id -> badge de PR, calculado por SesionScreen (computePrFlags) porque
  // depende de TODAS las series de la sesión, no solo de este bloque. Undefined
  // en HistorialScreen: ahí nunca hay PR.
  prBySetId?: Map<number, PrFlags>;
  // Tras guardar en Sesión: el bloque nace colapsado (solo nombres). Tocar el
  // header reexpande. Historial no pasa estas props y el bloque queda siempre
  // abierto, igual que antes.
  collapsed?: boolean;
  onToggleCollapse?: () => void;
};

const useStyles = makeStyles(({ colors }) => ({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    paddingVertical: 3,
    paddingHorizontal: space.sm,
    borderRadius: radius.pill,
    backgroundColor: colors.tintSoft,
  },
  round: { gap: space.sm },
  roundHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
}));

// Renderiza un bloque de super-serie como "rondas intercaladas": una ronda
// es una posición de serie compartida por todos los miembros del bloque
// (ronda 1 = primera serie de cada ejercicio del bloque, ronda 2 = segunda,
// etc.), en vez de una tarjeta por ejercicio como los ejercicios sueltos.
// "Añadir ronda" añade una fila a TODOS los miembros a la vez -- por eso
// las callbacks (onAddRound/onRemoveRound) no reciben qué miembro, solo el
// caller (SesionScreen/HistorialScreen) sabe qué índices de fila del
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
  onChangeUnit,
  latestBodyWeight = null,
  prBySetId,
  collapsed = false,
  onToggleCollapse,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const roundCount = members.reduce((max, m) => Math.max(max, m.sets.length), 0);
  const names = members.map((m) => m.name).join(" + ");

  return (
    <Card>
      <Pressable
        onPress={onToggleCollapse}
        disabled={!onToggleCollapse}
        accessibilityRole={onToggleCollapse ? "button" : undefined}
        accessibilityState={onToggleCollapse ? { expanded: !collapsed } : undefined}
        style={styles.headerRow}
      >
        <View style={styles.tag}>
          <Txt variant="caption" tone="tint" weight="700">
            Super-serie
          </Txt>
        </View>
        {onToggleCollapse ? (
          <Icon name={collapsed ? "expand" : "collapse"} size={14} color={colors.labelSecondary} />
        ) : null}
      </Pressable>

      {collapsed ? (
        <Txt variant="headline">{names}</Txt>
      ) : (
        <>
          {members.map((member, memberIndex) => (
            <View key={`unit-${member.key}`} style={{ gap: space.xs }}>
              <Txt variant="callout" weight="600">
                {String.fromCharCode(65 + memberIndex)} · {member.name}
              </Txt>
              <WeightUnitChips
                value={member.unit}
                onChange={(unit) => onChangeUnit?.(memberIndex, unit)}
                disabled={disabled || !onChangeUnit}
              />
            </View>
          ))}

          {Array.from({ length: roundCount }, (_, roundIndex) => {
            // Key estable por ronda: combina los ids (estables, de SetDraft) de
            // las filas presentes en esta ronda en vez del índice posicional --
            // si no, al quitar una ronda intermedia React podía reutilizar el
            // mismo TextInput enfocado para el valor de otra ronda.
            const roundKey = members.map((m) => m.sets[roundIndex]?.id ?? "x").join("-");

            return (
              <View key={roundKey} style={styles.round}>
                <View style={styles.roundHeader}>
                  <Txt variant="headline">Ronda {roundIndex + 1}</Txt>
                  {!disabled && (
                    <Button
                      title="Quitar ronda"
                      variant="plainDestructive"
                      size="compact"
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
                    <SetRow
                      key={member.key}
                      label={String.fromCharCode(65 + memberIndex)}
                      labelWidth={28}
                      unit={member.unit}
                      weight={setDraft.weight}
                      reps={setDraft.reps}
                      bodyWeightKg={latestBodyWeight}
                      editable={!disabled}
                      onChangeWeight={(text) => onChangeSet(memberIndex, roundIndex, { weight: text })}
                      onChangeReps={(text) => onChangeSet(memberIndex, roundIndex, { reps: text })}
                      flags={prBySetId?.get(setDraft.id) ?? NO_PR}
                    />
                  );
                })}
              </View>
            );
          })}

          {!disabled && (
            <Button title="Añadir ronda" icon="plus" variant="tinted" fullWidth onPress={onAddRound} />
          )}
        </>
      )}
    </Card>
  );
}
