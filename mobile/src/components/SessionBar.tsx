import { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";

type Props = {
  // ms epoch del inicio de sesión; null = aún no empezada.
  startedAt: number | null;
  // ms epoch de la última serie completada (reps escritas); ancla del descanso.
  lastSetAt: number | null;
  // Termina la sesión (el padre pide confirmación si hay un entreno sin guardar).
  onStop: () => void;
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
export default function SessionBar({ startedAt, lastSetAt, onStop, nextLabel, tip }: Props) {
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
      <View style={styles.topRow}>
        <View style={styles.clocks}>
          <View>
            <Text style={styles.clockLabel}>Sesión</Text>
            <Text style={styles.clockValue}>
              {startedAt === null ? "--:--" : formatClock((now - startedAt) / 1000)}
            </Text>
          </View>
          <View>
            <Text style={styles.clockLabel}>Descanso</Text>
            <Text style={styles.clockValue}>
              {lastSetAt === null ? "--:--" : formatClock((now - lastSetAt) / 1000)}
            </Text>
          </View>
        </View>
        <Button title="■ Terminar" color="#b00020" onPress={onStop} />
      </View>

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
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  clocks: { flexDirection: "row", gap: 24 },
  clockLabel: { fontSize: 12, color: "#555", textTransform: "uppercase" },
  clockValue: { fontSize: 22, fontWeight: "700", fontVariant: ["tabular-nums"] },
  next: { marginTop: 6, fontSize: 15, fontWeight: "600" },
  tip: { marginTop: 4, fontSize: 13, color: "#555" },
});
