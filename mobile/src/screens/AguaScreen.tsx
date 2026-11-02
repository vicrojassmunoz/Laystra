import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import { Modal, Pressable, View } from "react-native";

import { todayIsoDate } from "../api/today";
import {
  createWaterContainer,
  createWaterEntry,
  deleteWaterContainer,
  deleteWaterEntry,
  exportWaterCsv,
  fetchWaterContainers,
  fetchWaterDay,
  fetchWaterHistory,
  updateWaterContainer,
  updateWaterGoal,
} from "../api/water";
import Button from "../components/ui/Button";
import { Card, Section, SectionHeader } from "../components/ui/Card";
import Chip from "../components/ui/Chip";
import Icon from "../components/ui/Icon";
import ProgressBar from "../components/ui/ProgressBar";
import Row from "../components/ui/Row";
import Screen, { ScreenError, ScreenLoading } from "../components/ui/Screen";
import TextField from "../components/ui/TextField";
import Txt from "../components/ui/Txt";
import { makeStyles, radius, space, useTheme } from "../theme/theme";
import { WaterContainer, WaterDay, WaterDayTotal } from "../types/water";
import { showAlert } from "../utils/alert";
import { parseDecimalInput } from "../utils/number";
import { shareCsv } from "../utils/shareCsv";
import {
  CONTAINER_FRACTIONS,
  LARGE_WATER_ENTRY_ML,
  formatMl,
  fractionOf,
} from "../utils/water";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; day: WaterDay; containers: WaterContainer[]; history: WaterDayTotal[] };

// Ajuste "más o menos" de un recipiente antes de añadirlo (me bebí media botella).
type AdjustTarget = { container: WaterContainer; ml: number };

const STEP_ML = 50;
const MAX_ENTRY_ML = 5000;
const HISTORY_DAYS = 7;
const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

function weekdayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(y, m - 1, d).getDay()];
}

const useStyles = makeStyles(({ colors }) => ({
  totalRow: { flexDirection: "row", alignItems: "baseline", gap: space.sm },
  inline: { flexDirection: "row", alignItems: "center", gap: space.sm },
  grow: { flex: 1 },
  valueWithAction: { flexDirection: "row", alignItems: "center", gap: space.sm },
  reached: { flexDirection: "row", alignItems: "center", gap: space.sm },
  historyRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 28 },
  historyDay: { width: 52 },
  historyTrack: { flex: 1 },
  historyValue: { width: 64, textAlign: "right" },
  editRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: space.xl,
    paddingBottom: space.xxxl,
    gap: space.md,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.labelTertiary,
    marginBottom: space.xs,
  },
  chips: { flexDirection: "row", justifyContent: "center", gap: space.sm },
  stepper: { flexDirection: "row", justifyContent: "center", gap: space.md },
  sheetActions: { flexDirection: "row", gap: space.md, marginTop: space.sm },
  warnBox: {
    flexDirection: "row",
    gap: space.sm,
    alignItems: "center",
    backgroundColor: colors.warningSoft,
    borderRadius: radius.control,
    padding: space.md,
  },
}));

export default function AguaScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [state, setState] = useState<State>({ status: "loading" });
  const hasDataRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [customMl, setCustomMl] = useState("");
  const [adjust, setAdjust] = useState<AdjustTarget | null>(null);

  const [goalDraft, setGoalDraft] = useState<string | null>(null);

  const [managing, setManaging] = useState(false);
  // Borradores por id de recipiente (texto) + el formulario de alta.
  const [containerDrafts, setContainerDrafts] = useState<Record<number, { name: string; ml: string }>>({});
  const [newName, setNewName] = useState("");
  const [newMl, setNewMl] = useState("");

  const load = useCallback(() => {
    if (!hasDataRef.current) {
      setState({ status: "loading" });
    }
    const today = todayIsoDate();

    Promise.all([
      fetchWaterDay(today),
      fetchWaterContainers(),
      fetchWaterHistory(today, HISTORY_DAYS),
    ])
      .then(([day, containers, history]) => {
        hasDataRef.current = true;
        setState({ status: "ready", day, containers, history });
        setContainerDrafts(
          Object.fromEntries(containers.map((c) => [c.id, { name: c.name, ml: String(c.ml) }]))
        );
      })
      .catch((e: Error) => {
        if (!hasDataRef.current) {
          setState({ status: "error", message: e.message });
        } else {
          setError(e.message);
        }
      });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Ejecuta una mutación y recarga; centraliza busy/error para no repetirlo.
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    setError(null);
    try {
      await action();
      load();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Algo falló.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function addWater(ml: number, containerName: string | null) {
    const submit = () =>
      run(() => createWaterEntry({ date: todayIsoDate(), ml, container_name: containerName }));

    // Cantidades enormes en una sola entrada casi siempre son un typo.
    if (ml > LARGE_WATER_ENTRY_ML) {
      showAlert("¿Seguro?", `Vas a añadir ${formatMl(ml)} de golpe. ¿Es correcto?`, [
        { text: "Cancelar", style: "cancel" },
        { text: "Añadir", onPress: () => void submit() },
      ]);
      return Promise.resolve(false);
    }
    return submit();
  }

  async function addCustom() {
    const parsed = parseDecimalInput(customMl);
    if (parsed === null || !Number.isInteger(parsed) || parsed < 1 || parsed > MAX_ENTRY_ML) {
      setError(`Introduce una cantidad entera de ml entre 1 y ${MAX_ENTRY_ML}.`);
      return;
    }
    if (await addWater(parsed, null)) {
      setCustomMl("");
    }
  }

  function confirmAdjust() {
    if (!adjust) {
      return;
    }
    const { container, ml } = adjust;
    setAdjust(null);
    void addWater(ml, container.name);
  }

  function saveGoal() {
    if (goalDraft === null) {
      return;
    }
    const parsed = parseDecimalInput(goalDraft);
    if (parsed === null || !Number.isInteger(parsed) || parsed < 100 || parsed > 20000) {
      setError("El objetivo debe ser un número entero de ml entre 100 y 20000.");
      return;
    }
    void run(() => updateWaterGoal(parsed)).then((ok) => {
      if (ok) {
        setGoalDraft(null);
      }
    });
  }

  function saveContainer(container: WaterContainer) {
    const draft = containerDrafts[container.id];
    const ml = draft ? parseDecimalInput(draft.ml) : null;
    if (!draft || !draft.name.trim() || ml === null || !Number.isInteger(ml) || ml < 1 || ml > MAX_ENTRY_ML) {
      setError(`Nombre obligatorio y capacidad entera de ml entre 1 y ${MAX_ENTRY_ML}.`);
      return;
    }
    const save = () =>
      run(() => updateWaterContainer(container.id, { name: draft.name.trim(), ml }));

    if (ml !== container.ml) {
      // Cambiar la capacidad altera cuánto cuenta cada toque futuro, así que se
      // avisa. Lo ya registrado no cambia (cada entrada guarda sus propios ml).
      showAlert(
        "Cambiar capacidad",
        `"${container.name}" pasará de ${container.ml} ml a ${ml} ml. Solo afecta a lo que añadas desde ahora; el agua ya registrada no cambia.`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Cambiar", onPress: () => void save() },
        ]
      );
      return;
    }
    void save();
  }

  function removeContainer(container: WaterContainer) {
    showAlert("Borrar recipiente", `¿Borrar "${container.name}"? El agua ya registrada se mantiene.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: () => void run(() => deleteWaterContainer(container.id)),
      },
    ]);
  }

  function addContainer() {
    const ml = parseDecimalInput(newMl);
    if (!newName.trim() || ml === null || !Number.isInteger(ml) || ml < 1 || ml > MAX_ENTRY_ML) {
      setError(`Nombre obligatorio y capacidad entera de ml entre 1 y ${MAX_ENTRY_ML}.`);
      return;
    }
    void run(() => createWaterContainer({ name: newName.trim(), ml })).then((ok) => {
      if (ok) {
        setNewName("");
        setNewMl("");
      }
    });
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      await shareCsv(await exportWaterCsv(), "laystra-water.csv", "Exportar agua");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar el CSV.");
    } finally {
      setBusy(false);
    }
  }

  if (state.status === "loading") {
    return <ScreenLoading />;
  }
  if (state.status === "error") {
    return <ScreenError message={state.message} />;
  }

  const { day, containers, history } = state;
  const progress = day.goal_ml > 0 ? day.total_ml / day.goal_ml : 0;
  const reached = day.total_ml >= day.goal_ml;
  const lastEntry = day.entries.length > 0 ? day.entries[day.entries.length - 1] : null;

  return (
    <Screen>
      <Card>
        <View style={styles.totalRow}>
          <Txt variant="largeTitle" numeric>
            {formatMl(day.total_ml)}
          </Txt>
          <Txt variant="callout" tone="secondary" numeric>
            de {formatMl(day.goal_ml)}
          </Txt>
        </View>
        <ProgressBar value={progress} tone={reached ? "success" : "water"} height={10} />
        {reached ? (
          <View style={styles.reached}>
            <Icon name="check" size={18} color={colors.success} />
            <Txt variant="subhead" tone="success" weight="600">
              Objetivo cumplido
            </Txt>
          </View>
        ) : null}

        {goalDraft === null ? (
          <View style={{ alignSelf: "flex-start" }}>
            <Button
              title="Cambiar objetivo diario"
              variant="plain"
              size="compact"
              onPress={() => setGoalDraft(String(day.goal_ml))}
            />
          </View>
        ) : (
          <View style={styles.inline}>
            <TextField
              style={styles.grow}
              value={goalDraft}
              onChangeText={setGoalDraft}
              keyboardType="number-pad"
              placeholder="ml"
            />
            <Button title="Guardar" variant="filled" onPress={saveGoal} disabled={busy} />
            <Button title="Cancelar" variant="plain" onPress={() => setGoalDraft(null)} />
          </View>
        )}
      </Card>

      {error ? (
        <Txt variant="subhead" tone="danger">
          {error}
        </Txt>
      ) : null}

      <View>
        <Section
          title="Añadir"
          footer={
            containers.length === 0 ? 'No tienes recipientes. Crea uno en "Editar recipientes".' : undefined
          }
        >
          {containers.map((container) => (
            // Fila no tocable: dos botones explícitos (un <button> dentro de otro
            // es HTML inválido en web y un blanco táctil ambiguo en el móvil).
            <Row
              key={container.id}
              icon="water"
              iconTone="water"
              title={container.name}
              subtitle={`${container.ml} ml`}
              value={
                <View style={styles.valueWithAction}>
                  <Button
                    title="Ajustar"
                    variant="plain"
                    size="compact"
                    disabled={busy}
                    onPress={() => setAdjust({ container, ml: container.ml })}
                  />
                  <Button
                    title="Añadir"
                    variant="tinted"
                    size="compact"
                    disabled={busy}
                    onPress={() => void addWater(container.ml, container.name)}
                  />
                </View>
              }
            />
          ))}
        </Section>
      </View>

      <Card>
        <Txt variant="headline">Otra cantidad</Txt>
        <View style={styles.inline}>
          <TextField
            style={styles.grow}
            value={customMl}
            onChangeText={setCustomMl}
            keyboardType="number-pad"
            placeholder="ml"
            onSubmitEditing={() => void addCustom()}
          />
          <Button title="Añadir" variant="filled" onPress={() => void addCustom()} disabled={busy} />
        </View>
      </Card>

      <View>
        <SectionHeader>Hoy</SectionHeader>
        {day.entries.length === 0 ? (
          <Card>
            <Txt variant="subhead" tone="secondary">
              Todavía no has registrado agua hoy.
            </Txt>
          </Card>
        ) : (
          <Section>
            {day.entries.map((entry) => (
              <Row
                key={entry.id}
                title={`${entry.ml} ml`}
                subtitle={entry.container_name ?? undefined}
                value={
                  <Button
                    title="Quitar"
                    variant="plainDestructive"
                    size="compact"
                    disabled={busy}
                    onPress={() => void run(() => deleteWaterEntry(entry.id))}
                  />
                }
              />
            ))}
          </Section>
        )}
        {lastEntry ? (
          <View style={{ alignSelf: "flex-start", marginTop: space.sm }}>
            <Button
              title="Deshacer última"
              variant="plain"
              size="compact"
              disabled={busy}
              onPress={() => void run(() => deleteWaterEntry(lastEntry.id))}
            />
          </View>
        ) : null}
      </View>

      <View>
        <SectionHeader>{`Últimos ${HISTORY_DAYS} días`}</SectionHeader>
        <Card>
          {history.map((h) => {
            const pct = day.goal_ml > 0 ? h.total_ml / day.goal_ml : 0;
            return (
              <View key={h.date} style={styles.historyRow}>
                <Txt variant="subhead" tone="secondary" style={styles.historyDay}>
                  {weekdayLabel(h.date)} {h.date.slice(8)}
                </Txt>
                <View style={styles.historyTrack}>
                  <ProgressBar
                    value={pct}
                    tone={h.total_ml >= day.goal_ml ? "success" : "water"}
                    height={6}
                  />
                </View>
                <Txt variant="subhead" numeric style={styles.historyValue}>
                  {formatMl(h.total_ml)}
                </Txt>
              </View>
            );
          })}
        </Card>
      </View>

      <View>
        <SectionHeader>Recipientes</SectionHeader>
        <Card>
          {managing ? (
            <>
              <Txt variant="footnote" tone="secondary">
                Cambiar la capacidad solo afecta a lo que añadas desde ahora.
              </Txt>
              {containers.map((container) => {
                const draft = containerDrafts[container.id] ?? {
                  name: container.name,
                  ml: String(container.ml),
                };
                return (
                  <View key={container.id} style={styles.editRow}>
                    <TextField
                      style={{ flex: 2 }}
                      value={draft.name}
                      onChangeText={(name) =>
                        setContainerDrafts((prev) => ({ ...prev, [container.id]: { ...draft, name } }))
                      }
                      placeholder="Nombre"
                    />
                    <TextField
                      style={{ flex: 1 }}
                      value={draft.ml}
                      onChangeText={(ml) =>
                        setContainerDrafts((prev) => ({ ...prev, [container.id]: { ...draft, ml } }))
                      }
                      keyboardType="number-pad"
                      placeholder="ml"
                    />
                    <Button
                      title="Guardar"
                      variant="tinted"
                      size="compact"
                      onPress={() => saveContainer(container)}
                      disabled={busy}
                    />
                    <Button
                      title="Borrar"
                      variant="destructive"
                      size="compact"
                      onPress={() => removeContainer(container)}
                      disabled={busy}
                    />
                  </View>
                );
              })}

              <Txt variant="headline" style={{ marginTop: space.sm }}>
                Nuevo recipiente
              </Txt>
              <View style={styles.editRow}>
                <TextField
                  style={{ flex: 2 }}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Nombre"
                />
                <TextField
                  style={{ flex: 1 }}
                  value={newMl}
                  onChangeText={setNewMl}
                  keyboardType="number-pad"
                  placeholder="ml"
                />
                <Button title="Crear" variant="filled" size="compact" onPress={addContainer} disabled={busy} />
              </View>
            </>
          ) : null}
          <Button
            title={managing ? "Listo" : "Editar recipientes"}
            variant={managing ? "filled" : "tinted"}
            fullWidth
            onPress={() => setManaging((v) => !v)}
          />
        </Card>
      </View>

      <Button
        title="Exportar CSV"
        variant="plain"
        icon="note"
        onPress={() => void handleExport()}
        disabled={busy}
      />

      <Modal
        visible={adjust !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setAdjust(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setAdjust(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {adjust ? (
              <>
                <View style={styles.grabber} />
                <Txt variant="headline" style={{ textAlign: "center" }}>
                  Añadir {adjust.container.name}
                </Txt>
                <Txt variant="largeTitle" numeric style={{ textAlign: "center" }}>
                  {adjust.ml} ml
                </Txt>

                <View style={styles.chips}>
                  {CONTAINER_FRACTIONS.map((f) => (
                    <Chip
                      key={f.label}
                      label={f.label}
                      selected={adjust.ml === fractionOf(adjust.container.ml, f.factor)}
                      onPress={() =>
                        setAdjust({ ...adjust, ml: fractionOf(adjust.container.ml, f.factor) })
                      }
                    />
                  ))}
                </View>

                <View style={styles.stepper}>
                  <Button
                    title={`${STEP_ML}`}
                    icon="minus"
                    variant="tinted"
                    onPress={() => setAdjust({ ...adjust, ml: Math.max(STEP_ML, adjust.ml - STEP_ML) })}
                  />
                  <Button
                    title={`${STEP_ML}`}
                    icon="plus"
                    variant="tinted"
                    onPress={() =>
                      setAdjust({ ...adjust, ml: Math.min(MAX_ENTRY_ML, adjust.ml + STEP_ML) })
                    }
                  />
                </View>

                {adjust.ml !== adjust.container.ml ? (
                  <View style={styles.warnBox}>
                    <Icon name="info" size={18} color={colors.warning} />
                    <Txt variant="subhead" tone="warning" style={{ flex: 1 }}>
                      Ajustado: {adjust.ml} ml en vez de los {adjust.container.ml} ml del recipiente.
                    </Txt>
                  </View>
                ) : null}

                <View style={styles.sheetActions}>
                  <View style={{ flex: 1 }}>
                    <Button title="Cancelar" variant="tinted" size="large" fullWidth onPress={() => setAdjust(null)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Button title="Añadir" variant="filled" size="large" fullWidth onPress={confirmAdjust} />
                  </View>
                </View>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
