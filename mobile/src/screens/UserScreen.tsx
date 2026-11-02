import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import { View } from "react-native";

import { createBodyMetric, deleteBodyMetric, fetchBodyMetrics } from "../api/bodyMetrics";
import { todayIsoDate } from "../api/today";
import { exportWorkoutsCsv } from "../api/workouts";
import { exportWaterCsv } from "../api/water";
import Button from "../components/ui/Button";
import { Card, Section, SectionHeader } from "../components/ui/Card";
import Chip from "../components/ui/Chip";
import Icon from "../components/ui/Icon";
import Row from "../components/ui/Row";
import Screen, { ScreenError, ScreenLoading } from "../components/ui/Screen";
import TextField from "../components/ui/TextField";
import Txt from "../components/ui/Txt";
import { API_BASE_URL } from "../config";
import { INACTIVITY_LABEL } from "../session/SessionContext";
import { AppearancePreference, useAppearancePreference } from "../theme/appearance";
import { makeStyles, space, useTheme } from "../theme/theme";
import { BodyMetric } from "../types/bodyMetric";
import { showAlert } from "../utils/alert";
import { parseDecimalInput } from "../utils/number";
import { shareCsv } from "../utils/shareCsv";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; metrics: BodyMetric[] };

const APPEARANCE_OPTIONS: { value: AppearancePreference; label: string }[] = [
  { value: "system", label: "Sistema" },
  { value: "light", label: "Claro" },
  { value: "dark", label: "Oscuro" },
];

const VISIBLE_METRICS = 6;

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIso(toIso).getTime() - parseIso(fromIso).getTime()) / 86400000);
}

function agoLabel(iso: string): string {
  const days = daysBetween(iso, todayIsoDate());
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  return `hace ${days} días`;
}

// Cambio de peso respecto a la medición más antigua dentro de los 30 días
// previos a la última (las mediciones vienen ordenadas de más nueva a más vieja).
// Devuelve también cuántos días separan ambas, para decirlo tal cual en pantalla.
function monthChange(metrics: BodyMetric[]): { delta: number; days: number } | null {
  if (metrics.length < 2) return null;
  const latest = metrics[0];
  const inWindow = metrics.slice(1).filter((m) => {
    const days = daysBetween(m.date, latest.date);
    return days > 0 && days <= 30;
  });
  if (inWindow.length === 0) return null;
  const oldest = inWindow[inWindow.length - 1];
  return { delta: latest.weight - oldest.weight, days: daysBetween(oldest.date, latest.date) };
}

const useStyles = makeStyles(() => ({
  weightRow: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  inline: { flexDirection: "row", alignItems: "center", gap: space.sm },
  twoCols: { flexDirection: "row", gap: space.sm },
  grow: { flex: 1 },
  chips: { flexDirection: "row", gap: space.sm },
  trend: { flexDirection: "row", alignItems: "center", gap: space.xs },
}));

// Perfil: tu cuerpo (peso / %grasa), los ajustes de la app (apariencia,
// avisos) y tus datos (exportar). El backend no tiene PUT para BodyMetric --
// solo alta/lista/borrado, así que corregir una medición es borrar y reañadir.
export default function UserScreen() {
  const navigation = useNavigation();
  const styles = useStyles();
  const { colors } = useTheme();
  const [appearance, setAppearance] = useAppearancePreference();
  const [state, setState] = useState<State>({ status: "loading" });
  const hasDataRef = useRef(false);

  const [date, setDate] = useState(todayIsoDate());
  const [weight, setWeight] = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [exporting, setExporting] = useState<"workouts" | "water" | null>(null);

  const load = useCallback(() => {
    if (!hasDataRef.current) {
      setState({ status: "loading" });
    }

    fetchBodyMetrics()
      .then((metrics) => {
        hasDataRef.current = true;
        setState({ status: "ready", metrics });
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

  function confirmDelete(metric: BodyMetric) {
    showAlert("¿Borrar registro?", `Se borrará el registro del ${metric.date} permanentemente.`, [
      { text: "Cancelar", style: "cancel" },
      { text: "Borrar", style: "destructive", onPress: () => handleDelete(metric.id) },
    ]);
  }

  function handleDelete(id: number) {
    setActionError(null);
    deleteBodyMetric(id)
      .then(() => load())
      .catch((error: Error) => setActionError(error.message));
  }

  function handleSave() {
    setFormError(null);

    const dateValue = date.trim();
    // Validación de formato solo -- no comprueba que sea una fecha real
    // (p.ej. "2026-02-31" pasaría), el backend ya rechaza eso con un 422.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      setFormError("Fecha inválida. Usa el formato AAAA-MM-DD.");
      return;
    }

    const weightValue = parseDecimalInput(weight);
    if (weightValue === null) {
      setFormError("Peso inválido.");
      return;
    }

    // El %grasa es opcional: campo vacío -> null. Si trae texto, tiene que
    // parsear igual que el peso.
    let bodyFatValue: number | null = null;
    if (bodyFatPct.trim() !== "") {
      bodyFatValue = parseDecimalInput(bodyFatPct);
      if (bodyFatValue === null) {
        setFormError("%grasa inválido.");
        return;
      }
    }

    setSaving(true);
    createBodyMetric({ date: dateValue, weight: weightValue, body_fat_pct: bodyFatValue })
      .then(() => {
        setWeight("");
        setBodyFatPct("");
        setDate(todayIsoDate());
        load();
      })
      .catch((error: Error) => setFormError(error.message))
      .finally(() => setSaving(false));
  }

  async function handleExport(kind: "workouts" | "water") {
    setExporting(kind);
    setActionError(null);
    try {
      if (kind === "workouts") {
        await shareCsv(await exportWorkoutsCsv(), "laystra-workouts.csv", "Exportar entrenos");
      } else {
        await shareCsv(await exportWaterCsv(), "laystra-water.csv", "Exportar agua");
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo exportar el CSV.");
    } finally {
      setExporting(null);
    }
  }

  if (state.status === "loading") {
    return <ScreenLoading />;
  }
  if (state.status === "error") {
    return <ScreenError message={state.message} />;
  }

  const { metrics } = state;
  const latest = metrics[0] ?? null;
  const change = monthChange(metrics);
  const visible = showAll ? metrics : metrics.slice(0, VISIBLE_METRICS);
  const host = API_BASE_URL.replace(/^https?:\/\//, "");

  return (
    <Screen>
      <Card>
        <Txt variant="footnote" tone="secondary" weight="600">
          Peso corporal
        </Txt>
        {latest ? (
          <>
            <View style={styles.weightRow}>
              <Txt variant="largeTitle" numeric>
                {latest.weight}
              </Txt>
              <Txt variant="title3" tone="secondary">
                kg
              </Txt>
            </View>
            <Txt variant="subhead" tone="secondary">
              {agoLabel(latest.date)}
              {latest.body_fat_pct != null ? ` · ${latest.body_fat_pct} % de grasa` : ""}
            </Txt>
            {change !== null ? (
              <View style={styles.trend}>
                <Icon name="progress" size={16} color={colors.labelSecondary} />
                <Txt variant="subhead" tone="secondary" numeric>
                  {Math.round(change.delta * 10) === 0
                    ? `Sin cambios respecto a ${change.days} días antes`
                    : `${change.delta > 0 ? "+" : "−"}${Math.abs(Math.round(change.delta * 10) / 10)} kg respecto a ${change.days} días antes`}
                </Txt>
              </View>
            ) : null}
          </>
        ) : (
          <Txt variant="subhead" tone="secondary">
            Aún no hay mediciones. Añade tu peso abajo; los ejercicios de peso corporal (PC) usan
            la última medición.
          </Txt>
        )}
      </Card>

      <Card>
        <Txt variant="headline">Nueva medición</Txt>
        <TextField
          value={date}
          onChangeText={setDate}
          placeholder="AAAA-MM-DD"
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel="Fecha"
        />
        <View style={styles.twoCols}>
          <TextField
            style={styles.grow}
            value={weight}
            onChangeText={setWeight}
            placeholder="Peso (kg)"
            keyboardType="decimal-pad"
            accessibilityLabel="Peso en kilos"
          />
          <TextField
            style={styles.grow}
            value={bodyFatPct}
            onChangeText={setBodyFatPct}
            placeholder="% grasa (opcional)"
            keyboardType="decimal-pad"
            accessibilityLabel="Porcentaje de grasa"
          />
        </View>
        {formError ? (
          <Txt variant="subhead" tone="danger">
            {formError}
          </Txt>
        ) : null}
        <Button
          title={saving ? "Guardando..." : "Guardar medición"}
          variant="filled"
          size="large"
          fullWidth
          onPress={handleSave}
          disabled={saving}
        />
      </Card>

      {actionError ? (
        <Txt variant="subhead" tone="danger">
          {actionError}
        </Txt>
      ) : null}

      {metrics.length > 0 ? (
        <View>
          <Section title="Mediciones">
            {visible.map((metric) => (
              <Row
                key={metric.id}
                title={`${metric.weight} kg`}
                subtitle={`${metric.date}${metric.body_fat_pct != null ? ` · ${metric.body_fat_pct} % grasa` : ""}`}
                value={
                  <Button
                    title="Borrar"
                    variant="plainDestructive"
                    size="compact"
                    onPress={() => confirmDelete(metric)}
                  />
                }
              />
            ))}
          </Section>
          {metrics.length > VISIBLE_METRICS ? (
            <View style={{ alignSelf: "flex-start", marginTop: space.sm }}>
              <Button
                title={showAll ? "Ver menos" : `Ver las ${metrics.length}`}
                variant="plain"
                size="compact"
                onPress={() => setShowAll((v) => !v)}
              />
            </View>
          ) : null}
        </View>
      ) : null}

      <View>
        <SectionHeader>Apariencia</SectionHeader>
        <Card>
          <View style={styles.chips}>
            {APPEARANCE_OPTIONS.map((option) => (
              <Chip
                key={option.value}
                label={option.label}
                selected={appearance === option.value}
                onPress={() => setAppearance(option.value)}
              />
            ))}
          </View>
          <Txt variant="footnote" tone="secondary">
            Sistema sigue el modo claro/oscuro de tu iPhone.
          </Txt>
        </Card>
      </View>

      <Section title="Ajustes">
        <Row
          icon="water"
          iconTone="water"
          title="Objetivo de agua"
          subtitle="Se cambia desde la pantalla Agua"
          onPress={() => navigation.navigate("Agua")}
        />
        <Row
          icon="rest"
          title="Aviso de inactividad"
          subtitle="Notificación si no registras nada durante una sesión"
          value={INACTIVITY_LABEL}
        />
      </Section>

      <Section title="Tus datos" footer={`Servidor: ${host}`}>
        <Row
          icon="note"
          title="Exportar entrenos (CSV)"
          onPress={exporting ? undefined : () => void handleExport("workouts")}
          value={exporting === "workouts" ? "Exportando…" : undefined}
        />
        <Row
          icon="note"
          title="Exportar agua (CSV)"
          onPress={exporting ? undefined : () => void handleExport("water")}
          value={exporting === "water" ? "Exportando…" : undefined}
        />
      </Section>
    </Screen>
  );
}
