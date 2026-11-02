import { Pressable } from "react-native";

import { TOUCH, makeStyles, radius, space, useTheme } from "../../theme/theme";
import Txt from "./Txt";

const useStyles = makeStyles(({ colors }) => ({
  chip: {
    minHeight: 36,
    minWidth: TOUCH,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.fill,
  },
  selected: { backgroundColor: colors.tint },
  pressed: { opacity: 0.6 },
}));

// Opción de una selección corta (fracciones, unidades). Seleccionado = tint lleno.
export default function Chip({
  label,
  selected = false,
  onPress,
  disabled = false,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      hitSlop={{ top: 4, bottom: 4 }}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        disabled && { opacity: 0.4 },
        pressed && styles.pressed,
      ]}
    >
      <Txt
        variant="callout"
        weight="600"
        style={{ color: selected ? colors.onTint : colors.label }}
      >
        {label}
      </Txt>
    </Pressable>
  );
}
