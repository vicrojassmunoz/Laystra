import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchAnalyticsSummary } from "../api/analytics";
import { AnalyticsSummary } from "../types/analytics";
import { MUSCLE_GROUP_ORDER } from "../utils/exercisePicker";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: AnalyticsSummary };

// Un grupo muscular lleva "mucho" sin entrenarse a partir de esta cifra --
// puramente visual (resalta la fila), no afecta a ningún cálculo.
const STALE_DAYS_THRESHOLD = 7;

export default function AnalisisScreen() {
  const [state, setState] = useState<State>({ status: "loading" });
  const hasDataRef = useRef(false);

  const load = useCallback(() => {
    if (!hasDataRef.current) {
      setState({ status: "loading" });
    }

    fetchAnalyticsSummary()
      .then((data) => {
        hasDataRef.current = true;
        setState({ status: "ready", data });
      })
      .catch((error: Error) => {
        if (!hasDataRef.current) {
          setState({ status: "error", message: error.message });
        }
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (state.status === "loading") {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (state.status === "error") {
    return (
      <SafeAreaView style={styles.container} edges={["bottom"]}>
        <Text style={styles.title}>No se pudo conectar con el backend</Text>
        <Text style={styles.errorDetail}>{state.message}</Text>
      </SafeAreaView>
    );
  }

  const { data } = state;

  // El backend ya devuelve las dos listas en el orden de MUSCLE_GROUPS, pero
  // se reordena aquí igualmente por MUSCLE_GROUP_ORDER -- así el frontend no
  // depende silenciosamente de un orden que solo "da la casualidad" que
  // coincide, mismo catálogo que usa el picker de ejercicios.
  const volumeByLabel = new Map(data.volume_by_muscle.map((v) => [v.muscle_group, v.tonnage]));
  const gapByLabel = new Map(data.days_since_trained.map((g) => [g.muscle_group, g.days_since_trained]));
  const maxTonnage = Math.max(0, ...data.volume_by_muscle.map((v) => v.tonnage));

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Sin título propio: pantalla pusheada desde Home, header nativo ya
            muestra "Análisis" (ver App.tsx). Igual que UserScreen/Objetivos. */}
        <View style={styles.tonnageCard}>
          <Text style={styles.tonnageLabel}>Tonelaje esta semana</Text>
          <Text style={styles.tonnageValue}>{Math.round(data.week_tonnage)} kg</Text>
        </View>

        <Text style={styles.sectionTitle}>Volumen por músculo (últimos 7 días)</Text>
        {MUSCLE_GROUP_ORDER.map((label) => {
          const tonnage = volumeByLabel.get(label) ?? 0;
          const widthPct = maxTonnage > 0 ? (tonnage / maxTonnage) * 100 : 0;
          return (
            <View key={label} style={styles.volumeRow}>
              <Text style={styles.volumeLabel}>{label}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.barFill, { width: `${widthPct}%` }]} />
              </View>
              <Text style={styles.volumeValue}>{Math.round(tonnage)}</Text>
            </View>
          );
        })}

        <Text style={styles.sectionTitle}>Días sin entrenar</Text>
        {MUSCLE_GROUP_ORDER.map((label) => {
          const days = gapByLabel.get(label) ?? null;
          const isStale = days !== null && days >= STALE_DAYS_THRESHOLD;
          return (
            <View key={label} style={styles.gapRow}>
              <Text style={styles.gapLabel}>{label}</Text>
              <Text style={[styles.gapValue, isStale && styles.gapValueStale]}>
                {days === null ? "Nunca" : `${days} día${days === 1 ? "" : "s"}`}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 16,
  },
  tonnageCard: {
    backgroundColor: "#f4f4f4",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  tonnageLabel: {
    fontSize: 14,
    color: "#555",
    marginBottom: 4,
  },
  tonnageValue: {
    fontSize: 36,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 8,
    marginBottom: 10,
  },
  volumeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  volumeLabel: {
    fontSize: 14,
    color: "#333",
    width: 90,
  },
  barTrack: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#eee",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 6,
    backgroundColor: "#3b5bdb",
  },
  volumeValue: {
    fontSize: 13,
    color: "#555",
    width: 48,
    textAlign: "right",
  },
  gapRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  gapLabel: {
    fontSize: 15,
    color: "#333",
  },
  gapValue: {
    fontSize: 15,
    color: "#555",
  },
  gapValueStale: {
    color: "#b00020",
    fontWeight: "600",
  },
  errorDetail: {
    fontSize: 14,
    color: "#b00020",
    marginTop: 8,
  },
});
