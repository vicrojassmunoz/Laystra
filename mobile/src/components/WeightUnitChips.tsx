import { Pressable, View } from "react-native";

import { makeStyles, radius, space, useTheme } from "../theme/theme";
import { WeightUnit } from "../types/exercise";
import { showAlert } from "../utils/alert";
import { formatWeightUnit } from "../utils/weightUnit";
import Chip from "./ui/Chip";
import Icon from "./ui/Icon";
import Txt from "./ui/Txt";

const OPTIONS: { value: WeightUnit; label: string }[] = [
  { value: "kg", label: "kg" },
  { value: "lb", label: "lb" },
  { value: "bw", label: "PC" },
];

const useStyles = makeStyles(({ colors }) => ({
  row: { flexDirection: "row", alignItems: "center", gap: space.sm },
  info: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  locked: {
    flex: 1,
    // minWidth: 0: en web el <input> vecino impone su ancho intrínseco y, sin
    // esto, este bloque se aplastaba hasta una tira vertical de letras.
    minWidth: 0,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: space.sm,
    alignItems: "center",
    borderRadius: radius.control,
    borderCurve: "continuous",
    backgroundColor: colors.fill,
  },
}));

type ChipsProps = {
  value: WeightUnit;
  onChange: (unit: WeightUnit) => void;
  disabled?: boolean;
};

export function WeightUnitChips({ value, onChange, disabled }: ChipsProps) {
  const styles = useStyles();
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          selected={value === option.value}
          disabled={disabled}
          onPress={() => onChange(option.value)}
        />
      ))}
      {value === "bw" && (
        <Pressable
          style={styles.info}
          accessibilityRole="button"
          accessibilityLabel="Qué es PC"
          disabled={disabled}
          onPress={() =>
            showAlert(
              "Peso corporal (PC)",
              "PC registra la serie como peso corporal. Si tienes un peso en Perfil, se usa el último al guardar. Si no, se guarda solo como PC."
            )
          }
        >
          <Icon name="info" size={20} color={colors.tint} />
        </Pressable>
      )}
    </View>
  );
}

type LockedProps = {
  bodyWeightKg: number | null;
};

export function LockedBodyweightLabel({ bodyWeightKg }: LockedProps) {
  const styles = useStyles();
  return (
    <View style={styles.locked}>
      <Txt variant="body" tone="secondary" numeric numberOfLines={1}>
        {bodyWeightKg != null && bodyWeightKg > 0 ? `${bodyWeightKg} kg` : "PC"}
      </Txt>
    </View>
  );
}

export function formatSetLine(weight: number, unit: string, reps: number): string {
  if (unit === "bw") {
    const extra = weight > 0 ? ` · ${weight} kg` : "";
    return `PC${extra} x ${reps}`;
  }
  return `${weight}${formatWeightUnit(unit)} x ${reps}`;
}
