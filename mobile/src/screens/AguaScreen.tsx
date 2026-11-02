import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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
import { WaterContainer, WaterDay, WaterDayTotal } from "../types/water";
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

export default function AguaScreen() {
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
      Alert.alert(
        "¿Seguro?",
        `Vas a añadir ${formatMl(ml)} de golpe. ¿Es correcto?`,
        [
          { text: "Cancelar", style: "cancel" },
          { text: "Añadir", onPress: () => void submit() },
        ]
      );
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
      Alert.alert(
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
    Alert.alert("Borrar recipiente", `¿Borrar "${container.name}"? El agua ya registrada se mantiene.`, [
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

  const { day, containers, history } = state;
  const progress = Math.min(1, day.total_ml / day.goal_ml);
  const reached = day.total_ml >= day.goal_ml;
  const lastEntry = day.entries.length > 0 ? day.entries[day.entries.length - 1] : null;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Agua</Text>

          <View style={styles.card}>
            <Text style={styles.total}>
              {formatMl(day.total_ml)}{" "}
              <Text style={styles.totalGoal}>/ {formatMl(day.goal_ml)}</Text>
            </Text>
            <View style={styles.barTrack}>
              <View
                style={[styles.barFill, reached && styles.barFillDone, { width: `${progress * 100}%` }]}
              />
            </View>
            {reached && <Text style={styles.reachedText}>¡Objetivo cumplido! 💧</Text>}

            {goalDraft === null ? (
              <TouchableOpacity onPress={() => setGoalDraft(String(day.goal_ml))}>
                <Text style={styles.link}>Cambiar objetivo diario</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.inlineRow}>
                <TextInput
                  style={styles.input}
                  value={goalDraft}
                  onChangeText={setGoalDraft}
                  keyboardType="number-pad"
                  placeholder="ml"
                />
                <Button title="Guardar" onPress={saveGoal} disabled={busy} />
                <Button title="Cancelar" color="#666" onPress={() => setGoalDraft(null)} />
              </View>
            )}
          </View>

          {error && <Text style={styles.errorDetail}>{error}</Text>}

          <Text style={styles.sectionTitle}>Añadir</Text>
          {containers.length === 0 && (
            <Text style={styles.muted}>No tienes recipientes. Crea uno en "Editar recipientes".</Text>
          )}
          {containers.map((container) => (
            <View key={container.id} style={styles.containerRow}>
              <TouchableOpacity
                style={styles.containerButton}
                disabled={busy}
                onPress={() => void addWater(container.ml, container.name)}
              >
                <Text style={styles.containerButtonText}>+ {container.name}</Text>
                <Text style={styles.containerButtonMl}>{container.ml} ml</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.adjustButton}
                disabled={busy}
                onPress={() => setAdjust({ container, ml: container.ml })}
              >
                <Text style={styles.adjustButtonText}>Ajustar</Text>
              </TouchableOpacity>
            </View>
          ))}

          <View style={styles.inlineRow}>
            <TextInput
              style={styles.input}
              value={customMl}
              onChangeText={setCustomMl}
              keyboardType="number-pad"
              placeholder="Otra cantidad (ml)"
              onSubmitEditing={() => void addCustom()}
            />
            <Button title="Añadir" onPress={() => void addCustom()} disabled={busy} />
          </View>

          <Text style={styles.sectionTitle}>Hoy</Text>
          {day.entries.length === 0 && <Text style={styles.muted}>Todavía no has registrado agua hoy.</Text>}
          {day.entries.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              <Text style={styles.entryText}>
                {entry.ml} ml{entry.container_name ? ` · ${entry.container_name}` : ""}
              </Text>
              <Button
                title="Quitar"
                color="#b00020"
                disabled={busy}
                onPress={() => void run(() => deleteWaterEntry(entry.id))}
              />
            </View>
          ))}
          {lastEntry && (
            <View style={styles.undoButton}>
              <Button
                title="Deshacer última"
                disabled={busy}
                onPress={() => void run(() => deleteWaterEntry(lastEntry.id))}
              />
            </View>
          )}

          <Text style={styles.sectionTitle}>Últimos {HISTORY_DAYS} días</Text>
          {history.map((h) => {
            const pct = Math.min(1, h.total_ml / day.goal_ml);
            return (
              <View key={h.date} style={styles.historyRow}>
                <Text style={styles.historyDay}>
                  {weekdayLabel(h.date)} {h.date.slice(8)}
                </Text>
                <View style={styles.historyTrack}>
                  <View
                    style={[
                      styles.historyFill,
                      h.total_ml >= day.goal_ml && styles.barFillDone,
                      { width: `${pct * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.historyMl}>{formatMl(h.total_ml)}</Text>
              </View>
            );
          })}

          <View style={styles.manageHeader}>
            <Text style={styles.sectionTitle}>Recipientes</Text>
            <Button
              title={managing ? "Listo" : "Editar recipientes"}
              onPress={() => setManaging((v) => !v)}
            />
          </View>

          {managing && (
            <View>
              <Text style={styles.muted}>
                Cambiar la capacidad solo afecta a lo que añadas desde ahora.
              </Text>
              {containers.map((container) => {
                const draft = containerDrafts[container.id] ?? {
                  name: container.name,
                  ml: String(container.ml),
                };
                return (
                  <View key={container.id} style={styles.editContainerRow}>
                    <TextInput
                      style={[styles.input, styles.nameInput]}
                      value={draft.name}
                      onChangeText={(name) =>
                        setContainerDrafts((prev) => ({ ...prev, [container.id]: { ...draft, name } }))
                      }
                      placeholder="Nombre"
                    />
                    <TextInput
                      style={[styles.input, styles.mlInput]}
                      value={draft.ml}
                      onChangeText={(ml) =>
                        setContainerDrafts((prev) => ({ ...prev, [container.id]: { ...draft, ml } }))
                      }
                      keyboardType="number-pad"
                      placeholder="ml"
                    />
                    <Button title="Guardar" onPress={() => saveContainer(container)} disabled={busy} />
                    <Button
                      title="Borrar"
                      color="#b00020"
                      onPress={() => removeContainer(container)}
                      disabled={busy}
                    />
                  </View>
                );
              })}

              <Text style={styles.subSectionTitle}>Nuevo recipiente</Text>
              <View style={styles.editContainerRow}>
                <TextInput
                  style={[styles.input, styles.nameInput]}
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="Nombre"
                />
                <TextInput
                  style={[styles.input, styles.mlInput]}
                  value={newMl}
                  onChangeText={setNewMl}
                  keyboardType="number-pad"
                  placeholder="ml"
                />
                <Button title="Crear" onPress={addContainer} disabled={busy} />
              </View>
            </View>
          )}

          <View style={styles.undoButton}>
            <Button title="Exportar CSV" onPress={() => void handleExport()} disabled={busy} />
          </View>
        </ScrollView>

        <Modal visible={adjust !== null} transparent animationType="slide" onRequestClose={() => setAdjust(null)}>
          <Pressable style={styles.modalBackdrop} onPress={() => setAdjust(null)}>
            <Pressable style={styles.modalCard} onPress={() => {}}>
              {adjust && (
                <>
                  <Text style={styles.modalTitle}>Añadir {adjust.container.name}</Text>
                  <Text style={styles.modalAmount}>{adjust.ml} ml</Text>

                  <View style={styles.fractionRow}>
                    {CONTAINER_FRACTIONS.map((f) => (
                      <TouchableOpacity
                        key={f.label}
                        style={styles.fractionChip}
                        onPress={() =>
                          setAdjust({ ...adjust, ml: fractionOf(adjust.container.ml, f.factor) })
                        }
                      >
                        <Text style={styles.fractionChipText}>{f.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <View style={styles.stepperRow}>
                    <Button
                      title={`− ${STEP_ML}`}
                      onPress={() => setAdjust({ ...adjust, ml: Math.max(STEP_ML, adjust.ml - STEP_ML) })}
                    />
                    <Button
                      title={`+ ${STEP_ML}`}
                      onPress={() =>
                        setAdjust({ ...adjust, ml: Math.min(MAX_ENTRY_ML, adjust.ml + STEP_ML) })
                      }
                    />
                  </View>

                  {adjust.ml !== adjust.container.ml && (
                    <Text style={styles.warning}>
                      ⚠ Ajustado: {adjust.ml} ml en vez de los {adjust.container.ml} ml del recipiente.
                    </Text>
                  )}

                  <View style={styles.modalActions}>
                    <Button title="Cancelar" color="#666" onPress={() => setAdjust(null)} />
                    <Button title="Añadir" onPress={confirmAdjust} />
                  </View>
                </>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 24, fontWeight: "600", marginBottom: 16 },
  card: { backgroundColor: "#f4f4f4", borderRadius: 8, padding: 14, marginBottom: 12 },
  total: { fontSize: 32, fontWeight: "700", marginBottom: 10 },
  totalGoal: { fontSize: 18, fontWeight: "500", color: "#666" },
  barTrack: { height: 14, borderRadius: 7, backgroundColor: "#dbe4ee", overflow: "hidden" },
  barFill: { height: 14, borderRadius: 7, backgroundColor: "#3b8be0" },
  barFillDone: { backgroundColor: "#2e9e4f" },
  reachedText: { marginTop: 8, color: "#1b8a1b", fontWeight: "600" },
  link: { marginTop: 10, color: "#3b5bdb", fontSize: 14 },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginTop: 16, marginBottom: 8 },
  subSectionTitle: { fontSize: 15, fontWeight: "600", marginTop: 12, marginBottom: 6 },
  muted: { fontSize: 14, color: "#666", marginBottom: 8 },
  errorDetail: { fontSize: 14, color: "#b00020", marginVertical: 8 },
  inlineRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  containerRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  containerButton: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#e8f1fc",
    borderRadius: 8,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  containerButtonText: { fontSize: 16, fontWeight: "600" },
  containerButtonMl: { fontSize: 14, color: "#555" },
  adjustButton: {
    justifyContent: "center",
    backgroundColor: "#f4f4f4",
    borderRadius: 8,
    paddingHorizontal: 14,
  },
  adjustButtonText: { fontSize: 14, color: "#3b5bdb", fontWeight: "600" },
  entryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  entryText: { fontSize: 16 },
  undoButton: { marginTop: 12 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  historyDay: { width: 56, fontSize: 14, color: "#555" },
  historyTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: "#e6edf4", overflow: "hidden" },
  historyFill: { height: 10, borderRadius: 5, backgroundColor: "#3b8be0" },
  historyMl: { width: 64, fontSize: 14, textAlign: "right" },
  manageHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  editContainerRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  nameInput: { flex: 2 },
  mlInput: { flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    paddingBottom: 32,
  },
  modalTitle: { fontSize: 18, fontWeight: "600", textAlign: "center" },
  modalAmount: { fontSize: 36, fontWeight: "700", textAlign: "center", marginVertical: 12 },
  fractionRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginBottom: 12 },
  fractionChip: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: "#e8f1fc",
  },
  fractionChipText: { fontSize: 18, fontWeight: "600" },
  stepperRow: { flexDirection: "row", justifyContent: "center", gap: 24, marginBottom: 8 },
  warning: { color: "#b8860b", textAlign: "center", marginVertical: 8, fontSize: 14 },
  modalActions: { flexDirection: "row", justifyContent: "space-around", marginTop: 12 },
});
