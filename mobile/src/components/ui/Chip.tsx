import { haptic } from "../../motion/motion";
import { TOUCH, makeStyles, radius, space, useTheme } from "../../theme/theme";
import PressableScale from "./PressableScale";
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
  disabled: { opacity: 0.4 },
}));

// Opción de una selección corta (fracciones, unidades). Seleccionado = tint lleno.
// Elegir una opción nueva da un "tick" háptico (un valor que cambia de paso).
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
    <PressableScale
      onPress={() => {
        if (!selected) {
          haptic.tick();
        }
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      hitSlop={{ top: 4, bottom: 4 }}
      boxStyle={[styles.chip, selected && styles.selected, disabled && styles.disabled]}
    >
      <Txt
        variant="callout"
        weight="600"
        style={{ color: selected ? colors.onTint : colors.label }}
      >
        {label}
      </Txt>
    </PressableScale>
  );
}
