import { StyleSheet, Text } from "react-native";

import { PrFlags } from "../utils/pr";

// Insignia de PR para una serie: "🏆 PR" si supera el mejor peso histórico
// conocido del ejercicio, "💪 vol" si supera la mejor serie por volumen
// (peso×reps) -- pueden darse las dos a la vez (ver prFlags / bestWeights en
// TodayScreen). Se pinta en dos sitios -- ejercicios sueltos (TodayScreen) y
// dentro de un bloque de super-serie (SupersetBlock, compartido también con
// HistorialScreen, que no pasa bestWeights y por tanto nunca la pinta) -- así
// que vive en un componente propio en vez de duplicar el mismo <Text>/estilo.
export default function PrBadge({ flags }: { flags: PrFlags }) {
  if (!flags.weight && !flags.volume) {
    return null;
  }

  const label =
    flags.weight && flags.volume
      ? "🏆 PR · 💪 vol"
      : flags.weight
        ? "🏆 PR"
        : "💪 PR vol";

  return <Text style={styles.prBadge}>{label}</Text>;
}

const styles = StyleSheet.create({
  prBadge: {
    fontSize: 13,
    fontWeight: "700",
    color: "#b8860b",
  },
});
