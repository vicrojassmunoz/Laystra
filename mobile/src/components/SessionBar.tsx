import { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

type Props = {
  // ms epoch del inicio de sesión; null = aún no empezada.
  startedAt: number | null;
  // ms epoch de la última serie completada (reps escritas); ancla del descanso.
  lastSetAt: number | null;
  onStart: () => void;
  // "Siguiente: X" ya formateado por quien conoce el formulario; null = nada pendiente.
  nextLabel: string | null;
  tip: string | null;
};

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Barra de asistencia en sesión (ROADMAP #7): cronómetro de sesión, descanso
// desde la última serie, siguiente ejercicio y un tip estático. Solo en primer
// plano -- la alarma real con la app en background es el ítem #8 (EAS). El
// tick de 1 s vive aquí dentro para no re-renderizar toda la pantalla Hoy.
export default function SessionBar({ startedAt, lastSetAt, onStart, nextLabel, tip }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null) {
      return;
    }
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return (
    <View style={styles.bar}>
      {startedAt === null ? (
        <View style={styles.startRow}>
          <Text style={styles.hint}>Se inicia sola al escribir la primera serie.</Text>
          <Button title="▶ Iniciar sesión" onPress={onStart} />
        </View>
      ) : (
        <View style={styles.clocks}>
          <View style={styles.clock}>
            <Text style={styles.clockLabel}>Sesión</Text>
            <Text style={styles.clockValue}>{formatClock((now - startedAt) / 1000)}</Text>
          </View>
          <View style={styles.clock}>
            <Text style={styles.clockLabel}>Descanso</Text>
            <Text style={styles.clockValue}>
              {lastSetAt === null ? "--:--" : formatClock((now - lastSetAt) / 1000)}
            </Text>
          </View>
        </View>
      )}

      {nextLabel && <Text style={styles.next}>{nextLabel}</Text>}
      {tip && <Text style={styles.tip}>💡 {tip}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: "#eef4ff",
    borderBottomWidth: 1,
    borderBottomColor: "#c9dafc",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  startRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  hint: { flex: 1, fontSize: 13, color: "#555" },
  clocks: { flexDirection: "row", gap: 24 },
  clock: {},
  clockLabel: { fontSize: 12, color: "#555", textTransform: "uppercase" },
  clockValue: { fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] },
  next: { marginTop: 6, fontSize: 15, fontWeight: "600" },
  tip: { marginTop: 4, fontSize: 13, color: "#555" },
});
