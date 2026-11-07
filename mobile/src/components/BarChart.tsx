import { View } from "react-native";

import { makeStyles, space, useTheme } from "../theme/theme";
import Txt from "./ui/Txt";

// A partir de este número de barras, el gráfico ocupa todo el ancho de una tarjeta.
const FULL_WIDTH_BARS = 10;

type Bar = {
  value: number;
  // Marca la barra destacada (p. ej. el récord).
  highlight?: boolean;
};

const useStyles = makeStyles(({ colors }) => ({
  wrap: { gap: space.sm },
  // Más reciente a la derecha, como cualquier serie temporal.
  plot: { flexDirection: "row", alignItems: "flex-end", justifyContent: "flex-end", gap: 4 },
  // maxWidth: con pocas barras no se estiran a bloques enormes.
  barSlot: { flex: 1, maxWidth: 28, justifyContent: "flex-end" },
  baseline: { height: 1, backgroundColor: colors.separator },
  axis: { flexDirection: "row", justifyContent: "space-between" },
  axisEnd: { flexDirection: "row", justifyContent: "flex-end" },
}));

// Gráfico de barras sencillo (por defecto desde cero, para no exagerar cambios
// pequeños; `floor` permite fijar un mínimo distinto). `maxLabel` es el valor de la barra más alta; `startLabel` /
// `endLabel` ponen contexto en el eje horizontal (primera y última fecha).
export default function BarChart({
  bars,
  height = 120,
  floor = 0,
  maxLabel,
  startLabel,
  endLabel,
  accessibilityLabel,
}: {
  bars: Bar[];
  height?: number;
  // Valor que representa la base del gráfico (0 por defecto, siempre honesto).
  // Para series con poca variación (peso corporal) se puede subir; quien lo use
  // debe decirlo en pantalla.
  floor?: number;
  maxLabel?: string;
  startLabel?: string;
  endLabel?: string;
  accessibilityLabel?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const max = Math.max(floor, ...bars.map((b) => b.value));

  return (
    <View style={styles.wrap} accessible accessibilityLabel={accessibilityLabel}>
      {maxLabel ? (
        <Txt variant="caption" tone="secondary" numeric>
          {maxLabel}
        </Txt>
      ) : null}
      <View style={[styles.plot, { height }]}>
        {bars.map((bar, index) => {
          const ratio = max > floor ? (bar.value - floor) / (max - floor) : 0;
          return (
            <View key={index} style={[styles.barSlot, { height }]}>
              <View
                style={{
                  height: Math.max(3, ratio * height),
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  backgroundColor: bar.highlight ? colors.gold : colors.tint,
                  opacity: bar.highlight ? 1 : 0.85,
                }}
              />
            </View>
          );
        })}
      </View>
      <View style={styles.baseline} />
      {/* La fecha de inicio solo tiene sentido si las barras llenan el ancho; con
          pocas barras (alineadas a la derecha) solo se rotula la más reciente. */}
      {endLabel ? (
        <View style={bars.length >= FULL_WIDTH_BARS && startLabel ? styles.axis : styles.axisEnd}>
          {bars.length >= FULL_WIDTH_BARS && startLabel ? (
            <Txt variant="caption" tone="secondary">
              {startLabel}
            </Txt>
          ) : null}
          <Txt variant="caption" tone="secondary">
            {endLabel}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
