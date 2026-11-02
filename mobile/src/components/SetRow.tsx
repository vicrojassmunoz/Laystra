import { Pressable, View } from "react-native";

import { makeStyles, space, useTheme } from "../theme/theme";
import { WeightUnit } from "../types/exercise";
import { PrFlags } from "../utils/pr";
import { formatWeightUnit } from "../utils/weightUnit";
import PrBadge from "./PrBadge";
import Icon from "./ui/Icon";
import TextField from "./ui/TextField";
import Txt from "./ui/Txt";
import { LockedBodyweightLabel } from "./WeightUnitChips";

const useStyles = makeStyles(() => ({
  wrap: { gap: space.xs },
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  field: { flex: 1, textAlign: "center" },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
}));

type Props = {
  // Texto a la izquierda: "Serie 1" o el nombre del ejercicio dentro de una super-serie.
  label: string;
  labelWidth?: number;
  unit: WeightUnit;
  weight: string;
  reps: string;
  bodyWeightKg?: number | null;
  editable: boolean;
  onChangeWeight: (text: string) => void;
  onChangeReps: (text: string) => void;
  // Si se pasa, se muestra el botón de quitar (icono, 44 pt).
  onRemove?: () => void;
  flags?: PrFlags;
};

// Fila de una serie: etiqueta, peso, reps y quitar. El badge de PR va en su
// propia línea debajo para que la fila no se desborde en 390 pt.
export default function SetRow({
  label,
  labelWidth = 60,
  unit,
  weight,
  reps,
  bodyWeightKg = null,
  editable,
  onChangeWeight,
  onChangeReps,
  onRemove,
  flags,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Txt variant="subhead" tone="secondary" numberOfLines={1} style={{ width: labelWidth }}>
          {label}
        </Txt>
        {unit === "bw" ? (
          <LockedBodyweightLabel bodyWeightKg={bodyWeightKg} />
        ) : (
          <TextField
            style={styles.field}
            placeholder={formatWeightUnit(unit)}
            keyboardType="decimal-pad"
            value={weight}
            editable={editable}
            selectTextOnFocus
            onChangeText={onChangeWeight}
            accessibilityLabel={`Peso, ${label}`}
          />
        )}
        <Txt variant="callout" tone="tertiary">
          ×
        </Txt>
        <TextField
          style={styles.field}
          placeholder="reps"
          keyboardType="number-pad"
          value={reps}
          editable={editable}
          selectTextOnFocus
          onChangeText={onChangeReps}
          accessibilityLabel={`Repeticiones, ${label}`}
        />
        {onRemove ? (
          <Pressable
            onPress={onRemove}
            disabled={!editable}
            accessibilityRole="button"
            accessibilityLabel={`Quitar ${label}`}
            style={styles.remove}
          >
            <Icon name="remove" size={22} color={editable ? colors.labelSecondary : colors.labelTertiary} />
          </Pressable>
        ) : null}
      </View>
      {flags && (flags.weight || flags.volume) ? (
        <View style={{ marginLeft: labelWidth + space.sm }}>
          <PrBadge flags={flags} />
        </View>
      ) : null}
    </View>
  );
}
