import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";

import { fetchAnalyticsSummary } from "../api/analytics";
import { Card, Section, SectionHeader } from "../components/ui/Card";
import Icon from "../components/ui/Icon";
import ProgressBar from "../components/ui/ProgressBar";
import Row from "../components/ui/Row";
import Screen, { ScreenError, ScreenLoading } from "../components/ui/Screen";
import Txt from "../components/ui/Txt";
import { makeStyles, space, useTheme } from "../theme/theme";
import { AnalyticsSummary } from "../types/analytics";
import { MUSCLE_GROUP_ORDER } from "../utils/exercisePicker";
import { formatVolume } from "../utils/workoutSummary";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: AnalyticsSummary };

// Un grupo muscular lleva "mucho" sin entrenarse a partir de esta cifra --
// puramente visual (resalta la fila), no afecta a ningún cálculo.
const STALE_DAYS_THRESHOLD = 7;

const useStyles = makeStyles(() => ({
  volumeRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 28 },
  volumeLabel: { width: 96 },
  volumeBar: { flex: 1 },
  volumeValue: { width: 62, textAlign: "right" },
  insight: { flexDirection: "row", alignItems: "center", gap: space.sm },
  value: { flexDirection: "row", alignItems: "center", gap: space.xs },
}));

export default function AnalisisScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
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
    return <ScreenLoading />;
  }
  if (state.status === "error") {
    return <ScreenError message={state.message} />;
  }

  const { data } = state;

  // El backend devuelve las listas en el orden de MUSCLE_GROUPS; se indexa por
  // etiqueta y se recorre MUSCLE_GROUP_ORDER para no depender de ese orden.
  const volumeByLabel = new Map(data.volume_by_muscle.map((v) => [v.muscle_group, v.tonnage]));
  const gapByLabel = new Map(
    data.days_since_trained.map((g) => [g.muscle_group, g.days_since_trained])
  );
  const maxTonnage = Math.max(0, ...data.volume_by_muscle.map((v) => v.tonnage));

  // Volumen: de más a menos (los que no se han trabajado, al final, en el orden del catálogo).
  const volumeRows = MUSCLE_GROUP_ORDER.map((label) => ({
    label,
    tonnage: volumeByLabel.get(label) ?? 0,
  })).sort((a, b) => b.tonnage - a.tonnage);

  // Días sin entrenar: el más abandonado primero (nunca = el que más).
  const gapRows = MUSCLE_GROUP_ORDER.map((label) => ({
    label,
    days: gapByLabel.get(label) ?? null,
  })).sort((a, b) => {
    const av = a.days === null ? Number.POSITIVE_INFINITY : a.days;
    const bv = b.days === null ? Number.POSITIVE_INFINITY : b.days;
    return bv - av;
  });
  const neglected = gapRows.filter((g) => g.days === null || g.days >= STALE_DAYS_THRESHOLD);

  return (
    <Screen>
      <Card>
        <Txt variant="footnote" tone="secondary" weight="600">
          Volumen esta semana
        </Txt>
        <Txt variant="largeTitle" numeric>
          {formatVolume(data.week_tonnage)}
        </Txt>
        <Txt variant="subhead" tone="secondary">
          Suma de peso × repeticiones de los últimos 7 días.
        </Txt>
      </Card>

      {neglected.length > 0 ? (
        <Card>
          <View style={styles.insight}>
            <Icon name="info" size={20} color={colors.warning} />
            <Txt variant="headline" style={{ flex: 1 }}>
              Toca atender
            </Txt>
          </View>
          <Txt variant="subhead" tone="secondary">
            {neglected
              .slice(0, 3)
              .map((g) => (g.days === null ? `${g.label} (nunca)` : `${g.label} (${g.days} d)`))
              .join(" · ")}
          </Txt>
        </Card>
      ) : null}

      <View>
        <SectionHeader>Volumen por músculo · últimos 7 días</SectionHeader>
        <Card>
          {volumeRows.map(({ label, tonnage }) => (
            <View key={label} style={styles.volumeRow}>
              <Txt variant="subhead" tone={tonnage > 0 ? "label" : "secondary"} style={styles.volumeLabel}>
                {label}
              </Txt>
              <View style={styles.volumeBar}>
                <ProgressBar value={maxTonnage > 0 ? tonnage / maxTonnage : 0} height={8} />
              </View>
              <Txt variant="subhead" tone="secondary" numeric style={styles.volumeValue}>
                {tonnage > 0 ? formatVolume(tonnage) : "—"}
              </Txt>
            </View>
          ))}
        </Card>
      </View>

      <Section title="Días sin entrenar">
        {gapRows.map(({ label, days }) => {
          const stale = days === null || days >= STALE_DAYS_THRESHOLD;
          return (
            <Row
              key={label}
              title={label}
              value={
                <View style={styles.value}>
                  {stale ? <Icon name="info" size={15} color={colors.warning} /> : null}
                  <Txt variant="body" tone={stale ? "warning" : "secondary"} numeric>
                    {days === null ? "Nunca" : `${days} ${days === 1 ? "día" : "días"}`}
                  </Txt>
                </View>
              }
            />
          );
        })}
      </Section>
    </Screen>
  );
}
