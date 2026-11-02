import { View } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { VALUE_MS, transition } from "../../motion/motion";
import { makeStyles, useTheme } from "../../theme/theme";

const useStyles = makeStyles(({ colors }) => ({
  track: { backgroundColor: colors.fill, overflow: "hidden" },
}));

type Props = {
  // 0..1
  value: number;
  tone?: "tint" | "water" | "success";
  height?: number;
};

// Barra de progreso. Al cambiar el valor (p. ej. al añadir agua) el relleno crece
// con una transición suave -- indica QUÉ cambió. Animar `width` es aceptable aquí
// porque el relleno es un elemento sin hijos que no empuja a nadie (el skill lo
// permite expresamente para barras de progreso).
export default function ProgressBar({ value, tone = "tint", height = 8 }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2 }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Animated.View
        style={[
          {
            height,
            borderRadius: height / 2,
            width: `${clamped * 100}%`,
            backgroundColor: colors[tone],
          },
          transition(["width", "backgroundColor"], reduced ? 0 : VALUE_MS),
        ]}
      />
    </View>
  );
}
