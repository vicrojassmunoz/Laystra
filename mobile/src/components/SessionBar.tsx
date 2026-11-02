import { useEffect, useState } from "react";
import { View } from "react-native";

import { makeStyles, space, useTheme } from "../theme/theme";
import Button from "./ui/Button";
import Icon from "./ui/Icon";
import Txt from "./ui/Txt";

type Props = {
  // ms epoch del inicio de sesión; null = aún no empezada.
  startedAt: number | null;
  // ms epoch de la última serie completada (reps escritas); ancla del descanso.
  lastSetAt: number | null;
  // ms epoch de la pausa; null = corriendo.
  pausedAt: number | null;
  onTogglePause: () => void;
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

const useStyles = makeStyles(({ colors }) => ({
  bar: {
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.separator,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.sm,
  },
  barPaused: { backgroundColor: colors.warningSoft },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space.md },
  clocks: { flexDirection: "row", gap: space.xl },
  buttons: { flexDirection: "row", alignItems: "center", gap: space.sm },
  tipRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
}));

// Barra de asistencia en sesión (ROADMAP #7): cronómetro de sesión, descanso
// desde la última serie, siguiente ejercicio y un tip estático. Solo en primer
// plano -- la alarma real con la app en background es el ítem #8 (EAS). El
// tick de 1 s vive aquí dentro para no re-renderizar toda la pantalla Sesión.
export default function SessionBar({
  startedAt,
  lastSetAt,
  pausedAt,
  onTogglePause,
  onStop,
  nextLabel,
  tip,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null || pausedAt !== null) {
      return;
    }
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt, pausedAt]);

  // Congelado en la pausa: ambos relojes miden contra el instante de pausa.
  const clockNow = pausedAt ?? now;
  const paused = pausedAt !== null;

  return (
    <View style={[styles.bar, paused && styles.barPaused]}>
      <View style={styles.topRow}>
        <View style={styles.clocks}>
          <View>
            <Txt variant="caption" tone="secondary" weight="600">
              Sesión
            </Txt>
            <Txt variant="title2" numeric tone={paused ? "warning" : "label"}>
              {startedAt === null ? "--:--" : formatClock((clockNow - startedAt) / 1000)}
            </Txt>
          </View>
          <View>
            <Txt variant="caption" tone="secondary" weight="600">
              Descanso
            </Txt>
            <Txt variant="title2" numeric tone={paused ? "warning" : "label"}>
              {lastSetAt === null ? "--:--" : formatClock((clockNow - lastSetAt) / 1000)}
            </Txt>
          </View>
        </View>
        <View style={styles.buttons}>
          <Button
            title={paused ? "Reanudar" : "Pausa"}
            icon={paused ? "play" : "pause"}
            variant={paused ? "filled" : "tinted"}
            size="compact"
            onPress={onTogglePause}
          />
          <Button title="Terminar sesión" icon="stop" variant="destructive" size="compact" iconOnly onPress={onStop} />
        </View>
      </View>

      {paused ? (
        <Txt variant="subhead" tone="warning" weight="600">
          Sesión en pausa
        </Txt>
      ) : null}
      {nextLabel ? (
        <Txt variant="callout" weight="600">
          {nextLabel}
        </Txt>
      ) : null}
      {tip ? (
        <View style={styles.tipRow}>
          <Icon name="tip" size={15} color={colors.labelSecondary} />
          <Txt variant="footnote" tone="secondary" style={{ flex: 1 }}>
            {tip}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
