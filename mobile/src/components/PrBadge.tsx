import { StyleSheet, Text } from "react-native";

// Insignia "🏆 PR" para una serie cuyo peso supera el mejor histórico
// conocido de ese ejercicio (ver bestWeights en TodayScreen). Se pinta en dos
// sitios -- ejercicios sueltos (TodayScreen) y dentro de un bloque de
// super-serie (SupersetBlock, compartido también con HistorialScreen, que no
// pasa bestWeights y por tanto nunca la pinta) -- así que vive en un
// componente propio en vez de duplicar el mismo <Text>/estilo dos veces.
export default function PrBadge() {
  return <Text style={styles.prBadge}>🏆 PR</Text>;
}

const styles = StyleSheet.create({
  prBadge: {
    fontSize: 13,
    fontWeight: "700",
    color: "#b8860b",
  },
});
