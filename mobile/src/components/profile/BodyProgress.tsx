import { View } from "react-native";

import { makeStyles, space, useTheme } from "../../theme/theme";
import { BodyMetric } from "../../types/bodyMetric";
import { dayLabel } from "../../utils/workoutSummary";
import BarChart from "../BarChart";
import { Card } from "../ui/Card";
import Icon from "../ui/Icon";
import Txt from "../ui/Txt";

const useStyles = makeStyles(() => ({
  stats: { flexDirection: "row", gap: space.lg },
  stat: { flex: 1, gap: 2 },
  value: { flexDirection: "row", alignItems: "baseline", gap: space.xs },
  trend: { flexDirection: "row", alignItems: "center", gap: space.xs },
}));

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIso(toIso).getTime() - parseIso(fromIso).getTime()) / 86400000);
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function signed(n: number): string {
  const r = round1(n);
  return r === 0 ? "0" : `${r > 0 ? "+" : "−"}${Math.abs(r)}`;
}

// Tendencia de los últimos 30 días respecto a la medición más antigua de esa
// ventana. Descriptiva, sin juicio (subir o bajar no es bueno ni malo en sí).
function trendText(chron: BodyMetric[]): string | null {
  if (chron.length < 2) return null;
  const latest = chron[chron.length - 1];
  const base = chron.find((m) => {
    const d = daysBetween(m.date, latest.date);
    return d > 0 && d <= 30;
  });
  if (!base) return null;
  const delta = latest.weight - base.weight;
  const days = daysBetween(base.date, latest.date);
  if (Math.abs(delta) < 0.3) return `Estable en los últimos ${days} días`;
  return `${delta > 0 ? "Subiendo" : "Bajando"}: ${signed(delta)} kg en ${days} días`;
}

// Bloque de progreso corporal del Perfil: inicio vs ahora, variación,
// tendencia y gráfica del peso (reutiliza BarChart de Progreso). `metrics`
// llega ordenado de más nueva a más vieja.
export default function BodyProgress({ metrics }: { metrics: BodyMetric[] }) {
  const styles = useStyles();
  const { colors } = useTheme();

  if (metrics.length === 0) {
    return (
      <Card>
        <Txt variant="headline">Tu progreso</Txt>
        <Txt variant="subhead" tone="secondary">
          Aún no hay mediciones. Añade tu peso abajo y aquí verás cómo evoluciona; los ejercicios
          de peso corporal (PC) usan la última medición.
        </Txt>
      </Card>
    );
  }

  const chron = metrics.slice().reverse();
  const first = chron[0];
  const latest = chron[chron.length - 1];
  const delta = latest.weight - first.weight;
  const trend = trendText(chron);

  const withFat = chron.filter((m) => m.body_fat_pct != null);
  const fatFirst = withFat[0];
  const fatLatest = withFat[withFat.length - 1];

  const recent = chron.slice(-16);
  const values = recent.map((m) => m.weight);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // La gráfica de peso no parte de cero (80 vs 81 kg serían barras idénticas):
  // la base se sube y se avisa en pantalla.
  const floor = Math.max(0, Math.floor(min - Math.max(1, (max - min) * 0.5)));

  return (
    <Card>
      <Txt variant="footnote" tone="secondary" weight="600">
        Peso corporal
      </Txt>
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Txt variant="footnote" tone="secondary">
            {chron.length > 1 ? "Inicio" : "Primera medición"}
          </Txt>
          <View style={styles.value}>
            <Txt variant="title2" numeric>
              {first.weight}
            </Txt>
            <Txt variant="subhead" tone="secondary">
              kg
            </Txt>
          </View>
          <Txt variant="caption" tone="secondary">
            {dayLabel(first.date)}
          </Txt>
        </View>
        <View style={styles.stat}>
          <Txt variant="footnote" tone="secondary">
            Ahora
          </Txt>
          <View style={styles.value}>
            <Txt variant="title2" numeric>
              {latest.weight}
            </Txt>
            <Txt variant="subhead" tone="secondary">
              kg
            </Txt>
          </View>
          <Txt variant="caption" tone="secondary">
            {dayLabel(latest.date)}
          </Txt>
        </View>
        <View style={styles.stat}>
          <Txt variant="footnote" tone="secondary">
            Variación
          </Txt>
          <View style={styles.value}>
            <Txt variant="title2" numeric>
              {chron.length > 1 ? signed(delta) : "—"}
            </Txt>
            {chron.length > 1 ? (
              <Txt variant="subhead" tone="secondary">
                kg
              </Txt>
            ) : null}
          </View>
        </View>
      </View>

      {trend ? (
        <View style={styles.trend}>
          <Icon name="progress" size={16} color={colors.labelSecondary} />
          <Txt variant="subhead" tone="secondary" numeric>
            {trend}
          </Txt>
        </View>
      ) : null}

      {fatLatest ? (
        <Txt variant="subhead" tone="secondary" numeric>
          {fatFirst !== fatLatest
            ? `Grasa: ${fatFirst.body_fat_pct} % → ${fatLatest.body_fat_pct} % (${signed((fatLatest.body_fat_pct as number) - (fatFirst.body_fat_pct as number))} puntos)`
            : `Grasa: ${fatLatest.body_fat_pct} %`}
        </Txt>
      ) : null}

      {recent.length >= 3 ? (
        <BarChart
          bars={recent.map((m) => ({ value: m.weight }))}
          floor={floor}
          maxLabel={`${max} kg · eje desde ${floor} kg`}
          startLabel={dayLabel(recent[0].date)}
          endLabel={dayLabel(latest.date)}
          accessibilityLabel={`Gráfico de ${recent.length} mediciones de peso, de ${recent[0].weight} a ${latest.weight} kilos`}
        />
      ) : (
        <Txt variant="footnote" tone="secondary">
          Con 3 mediciones o más verás aquí la gráfica.
        </Txt>
      )}
    </Card>
  );
}
