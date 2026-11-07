import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { createBodyMetric, deleteBodyMetric, fetchBodyMetrics } from "../api/bodyMetrics";
import { todayIsoDate } from "../api/today";
import { exportWorkoutsCsv } from "../api/workouts";
import { exportWaterCsv } from "../api/water";
import Avatar from "../components/profile/Avatar";
import BodyProgress from "../components/profile/BodyProgress";
import InjuriesSection from "../components/profile/InjuriesSection";
import Button from "../components/ui/Button";
import { Card, Section, SectionHeader } from "../components/ui/Card";
import Chip from "../components/ui/Chip";
import Row from "../components/ui/Row";
import Screen, { ScreenError, ScreenLoading } from "../components/ui/Screen";
import TextField from "../components/ui/TextField";
import Txt from "../components/ui/Txt";
import { API_BASE_URL } from "../config";
import { INACTIVITY_LABEL } from "../session/SessionContext";
import { AppearancePreference, useAppearancePreference } from "../theme/appearance";
import { makeStyles, space } from "../theme/theme";
import { BodyMetric } from "../types/bodyMetric";
import { showAlert } from "../utils/alert";
import { parseDecimalInput } from "../utils/number";
import {
  loadProfileName,
  loadProfilePhotoUri,
  pickProfilePhoto,
  removeProfilePhoto,
  saveProfileName,
} from "../utils/profilePhoto";
import { REST_OPTIONS, formatRestLabel, useRestSeconds } from "../utils/restTimer";
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

const useStyles = makeStyles(() => ({
  header: { alignItems: "center", gap: space.md, paddingVertical: space.sm },
  photoActions: { flexDirection: "row", gap: space.sm },
  nameField: { alignSelf: "stretch" },
  inline: { flexDirection: "row", alignItems: "center", gap: space.sm },
  twoCols: { flexDirection: "row", gap: space.sm },
  grow: { flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
}));

// Perfil: tu cuerpo (peso / %grasa), los ajustes de la app (apariencia,
// avisos) y tus datos (exportar). El backend no tiene PUT para BodyMetric --
// solo alta/lista/borrado, así que corregir una medición es borrar y reañadir.
export default function UserScreen() {
  const navigation = useNavigation();
  const styles = useStyles();
    const [appearance, setAppearance] = useAppearancePreference();
  const [restSeconds, setRestSeconds] = useRestSeconds();
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
  const [showForm, setShowForm] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [name, setName] = useState("");

  // Foto y nombre viven en el dispositivo (AsyncStorage + carpeta de documentos).
  useEffect(() => {
    loadProfilePhotoUri().then(setPhotoUri).catch(() => {});
    loadProfileName().then(setName).catch(() => {});
  }, []);

  async function handlePickPhoto() {
    setActionError(null);
    try {
      const uri = await pickProfilePhoto();
      if (uri) setPhotoUri(uri);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "No se pudo elegir la foto.");
    }
  }

  async function handleRemovePhoto() {
    await removeProfilePhoto();
    setPhotoUri(null);
  }

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
        setShowForm(false);
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
  const visible = showAll ? metrics : metrics.slice(0, VISIBLE_METRICS);
  const host = API_BASE_URL.replace(/^https?:\/\//, "");

  return (
    <Screen>
      <View style={styles.header}>
        <Avatar uri={photoUri} name={name} />
        <View style={styles.photoActions}>
          <Button
            title={photoUri ? "Cambiar foto" : "Elegir foto"}
            variant="tinted"
            size="compact"
            onPress={() => void handlePickPhoto()}
          />
          {photoUri ? (
            <Button
              title="Quitar"
              variant="plainDestructive"
              size="compact"
              onPress={() => void handleRemovePhoto()}
            />
          ) : null}
        </View>
        <TextField
          style={styles.nameField}
          value={name}
          onChangeText={setName}
          onEndEditing={() => void saveProfileName(name)}
          placeholder="Tu nombre (para las iniciales)"
          autoCorrect={false}
          accessibilityLabel="Tu nombre"
        />
      </View>

      <BodyProgress metrics={metrics} />

      {!showForm ? (
        <Button
          title="Nueva medición"
          icon="plus"
          variant="tinted"
          fullWidth
          onPress={() => setShowForm(true)}
        />
      ) : null}

      {showForm ? (
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
        <Button title="Cancelar" variant="plain" fullWidth onPress={() => setShowForm(false)} />
      </Card>
      ) : null}

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

      <InjuriesSection />

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

      <View>
        <SectionHeader>Descanso entre series</SectionHeader>
        <Card>
          <View style={styles.chips}>
            {REST_OPTIONS.map((seconds) => (
              <Chip
                key={seconds}
                label={formatRestLabel(seconds)}
                selected={restSeconds === seconds}
                onPress={() => setRestSeconds(seconds)}
              />
            ))}
          </View>
          <Txt variant="footnote" tone="secondary">
            Al completar una serie empieza una cuenta atrás en Sesión y, con la app en segundo
            plano, suena una notificación al terminar (sonido estándar de iOS, no una alarma en
            bucle; respeta el modo silencio y Concentración).
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
