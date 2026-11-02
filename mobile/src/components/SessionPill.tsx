import { View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSession } from "../session/SessionContext";
import { makeStyles, space, useTheme } from "../theme/theme";
import SessionClock from "./SessionClock";
import Icon from "./ui/Icon";
import PressableScale from "./ui/PressableScale";

const useStyles = makeStyles(({ colors }) => ({
  wrap: {
    position: "absolute",
    right: space.md,
    zIndex: 1000,
    elevation: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    minHeight: 36,
    paddingHorizontal: space.md,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.separator,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
}));

// Indicador flotante "tu sesión sigue en marcha", visible en todas las pantallas
// salvo en la propia sesión. Toque = volver a ella.
export default function SessionPill({
  currentRoute,
  onPress,
}: {
  currentRoute: string | undefined;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { active, startedAt, pausedAt } = useSession();
  const insets = useSafeAreaInsets();

  if (!active || startedAt === null || currentRoute === "Sesion") {
    return null;
  }

  const paused = pausedAt !== null;

  return (
    // Aparece / desaparece con un fundido corto (elemento "ocasional").
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(120)}
      style={[styles.wrap, { top: insets.top + 6 }]}
    >
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={paused ? "Volver a la sesión en pausa" : "Volver a la sesión en curso"}
        hitSlop={8}
        boxStyle={styles.pill}
      >
        <View style={[styles.dot, { backgroundColor: paused ? colors.warning : colors.success }]} />
        <Icon name="train" size={16} color={colors.tint} />
        <SessionClock
          startedAt={startedAt}
          pausedAt={pausedAt}
          variant="subhead"
          tone={paused ? "warning" : "label"}
        />
      </PressableScale>
    </Animated.View>
  );
}
