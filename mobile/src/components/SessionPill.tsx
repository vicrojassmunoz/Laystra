import { Pressable, StyleSheet, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSession } from "../session/SessionContext";
import SessionClock from "./SessionClock";

// Indicador flotante "tu sesión sigue en marcha", visible en todas las pantallas
// salvo en la propia sesión. Toque = volver a ella.
export default function SessionPill({
  currentRoute,
  onPress,
}: {
  currentRoute: string | undefined;
  onPress: () => void;
}) {
  const { active, startedAt } = useSession();
  const insets = useSafeAreaInsets();

  if (!active || startedAt === null || currentRoute === "Sesion") {
    return null;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Volver a la sesión en curso"
      style={[styles.pill, { top: insets.top + 6 }]}
      hitSlop={8}
    >
      <Text style={styles.dot}>●</Text>
      <Text style={styles.icon}>🏋️</Text>
      <SessionClock startedAt={startedAt} style={styles.time} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    position: "absolute",
    right: 12,
    zIndex: 1000,
    elevation: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1b8a1b",
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  dot: { color: "#c6f6d5", fontSize: 10 },
  icon: { fontSize: 14 },
  time: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
});
