import { useCallback, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Switch, View } from "react-native";

import { createInjury, deleteInjury, fetchInjuries, updateInjury } from "../../api/injuries";
import { todayIsoDate } from "../../api/today";
import { makeStyles, space, useTheme } from "../../theme/theme";
import { Injury, InjuryInput } from "../../types/injury";
import { showAlert } from "../../utils/alert";
import { BODY_AREAS, SEVERITIES, bodyAreaLabel, severityLabel } from "../../utils/injuryMap";
import Button from "../ui/Button";
import { Card, Section, SectionHeader } from "../ui/Card";
import Chip from "../ui/Chip";
import Row from "../ui/Row";
import TextField from "../ui/TextField";
import Txt from "../ui/Txt";
import { useFocusEffect } from "@react-navigation/native";

const useStyles = makeStyles(({ colors }) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  avoider: { maxHeight: "92%" },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: space.md,
    paddingHorizontal: space.xl,
    paddingBottom: space.xxl,
    gap: space.md,
    flexShrink: 1,
  },
  grabber: {
    alignSelf: "center",
    width: 36,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.labelTertiary,
  },
  formScroll: { flexShrink: 1 },
  formContent: { gap: space.md, paddingBottom: space.sm },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  actions: { flexDirection: "row", gap: space.md },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
}));

type Form = {
  title: string;
  body_area: InjuryInput["body_area"];
  severity: InjuryInput["severity"];
  since: string;
  active: boolean;
  notes: string;
};

function emptyForm(): Form {
  return {
    title: "",
    body_area: "rodilla",
    severity: "leve",
    since: todayIsoDate(),
    active: true,
    notes: "",
  };
}

function toInput(injury: Injury, active: boolean): InjuryInput {
  return {
    title: injury.title,
    body_area: injury.body_area,
    severity: injury.severity,
    since: injury.since,
    active,
    notes: injury.notes,
  };
}

// Sección Lesiones del Perfil: lista con interruptor activa/inactiva y hoja de
// alta/edición. Las lesiones activas hacen que los selectores de ejercicio
// muestren un aviso prudente (no bloqueante).
export default function InjuriesSection() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [injuries, setInjuries] = useState<Injury[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<Form>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetchInjuries()
      .then((list) => {
        setError(null);
        // Activas primero; dentro de cada grupo, la más reciente arriba.
        setInjuries(
          list.slice().sort((a, b) =>
            a.active !== b.active ? (a.active ? -1 : 1) : a.since < b.since ? 1 : -1
          )
        );
      })
      .catch((e: Error) => setError(e.message));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function openCreate() {
    setForm(emptyForm());
    setEditingId(null);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(injury: Injury) {
    setForm({
      title: injury.title,
      body_area: injury.body_area,
      severity: injury.severity,
      since: injury.since,
      active: injury.active,
      notes: injury.notes ?? "",
    });
    setEditingId(injury.id);
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingId(null);
  }

  function handleSave() {
    const title = form.title.trim();
    if (!title) {
      setFormError("Ponle un nombre a la lesión.");
      return;
    }
    const since = form.since.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) {
      setFormError("Fecha inválida. Usa el formato AAAA-MM-DD.");
      return;
    }
    const payload: InjuryInput = {
      title,
      body_area: form.body_area,
      severity: form.severity,
      since,
      active: form.active,
      notes: form.notes.trim() || null,
    };
    setSaving(true);
    setFormError(null);
    const request =
      editingId === null ? createInjury(payload) : updateInjury(editingId, payload);
    request
      .then(() => {
        closeForm();
        load();
      })
      .catch((e: Error) => setFormError(e.message))
      .finally(() => setSaving(false));
  }

  function toggleActive(injury: Injury, active: boolean) {
    // Optimista: se refleja ya en la lista y se revierte con load() si falla.
    setInjuries((prev) => prev.map((i) => (i.id === injury.id ? { ...i, active } : i)));
    updateInjury(injury.id, toInput(injury, active))
      .then(load)
      .catch((e: Error) => {
        setError(e.message);
        load();
      });
  }

  function confirmDelete() {
    if (editingId === null) return;
    const id = editingId;
    showAlert("¿Borrar lesión?", "Se borrará de forma permanente.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: () => {
          deleteInjury(id)
            .then(() => {
              closeForm();
              load();
            })
            .catch((e: Error) => setFormError(e.message));
        },
      },
    ]);
  }

  return (
    <View>
      <View style={styles.headerRow}>
        <SectionHeader>Lesiones</SectionHeader>
        <Button title="Añadir" icon="plus" variant="plain" size="compact" onPress={openCreate} />
      </View>

      {error ? (
        <Txt variant="subhead" tone="danger">
          {error}
        </Txt>
      ) : null}

      {injuries.length === 0 ? (
        <Card>
          <Txt variant="subhead" tone="secondary">
            Sin lesiones registradas. Si añades una activa, al elegir ejercicios verás un aviso
            cuando puedan cargar esa zona.
          </Txt>
        </Card>
      ) : (
        <Section footer="Los avisos son orientativos y no sustituyen la opinión de un profesional.">
          {injuries.map((injury) => (
            <Row
              key={injury.id}
              icon="info"
              iconTone={injury.active ? "warning" : "tertiary"}
              title={injury.title}
              subtitle={`${bodyAreaLabel(injury.body_area)} · ${severityLabel(injury.severity)} · desde ${injury.since}${injury.active ? "" : " · inactiva"}`}
              titleTone={injury.active ? "label" : "secondary"}
              onPress={() => openEdit(injury)}
              value={
                <Switch
                  value={injury.active}
                  onValueChange={(v) => toggleActive(injury, v)}
                  trackColor={{ true: colors.tint }}
                  accessibilityLabel={`Lesión ${injury.title} activa`}
                />
              }
              chevron={false}
            />
          ))}
        </Section>
      )}

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={closeForm}>
        <View style={styles.backdrop}>
          <KeyboardAvoidingView
            style={styles.avoider}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={styles.sheet}>
              <View style={styles.grabber} />
              <Txt variant="title3" style={{ textAlign: "center" }}>
                {editingId === null ? "Nueva lesión" : "Editar lesión"}
              </Txt>

              <ScrollView
                style={styles.formScroll}
                contentContainerStyle={styles.formContent}
                keyboardShouldPersistTaps="handled"
              >
                <TextField
                  placeholder="Nombre (p. ej. Tendinitis rotuliana)"
                  value={form.title}
                  onChangeText={(title) => setForm((p) => ({ ...p, title }))}
                  editable={!saving}
                  accessibilityLabel="Nombre de la lesión"
                />

                <Txt variant="footnote" tone="secondary" weight="600">
                  Zona
                </Txt>
                <View style={styles.chipWrap}>
                  {BODY_AREAS.map((area) => (
                    <Chip
                      key={area.value}
                      label={area.label}
                      selected={form.body_area === area.value}
                      disabled={saving}
                      onPress={() => setForm((p) => ({ ...p, body_area: area.value }))}
                    />
                  ))}
                </View>
                {form.body_area === "otro" ? (
                  <Txt variant="footnote" tone="secondary">
                    Con &quot;Otro&quot; no se puede relacionar con ejercicios, así que no habrá avisos.
                  </Txt>
                ) : null}

                <Txt variant="footnote" tone="secondary" weight="600">
                  Gravedad
                </Txt>
                <View style={styles.chipWrap}>
                  {SEVERITIES.map((s) => (
                    <Chip
                      key={s.value}
                      label={s.label}
                      selected={form.severity === s.value}
                      disabled={saving}
                      onPress={() => setForm((p) => ({ ...p, severity: s.value }))}
                    />
                  ))}
                </View>

                <TextField
                  placeholder="Desde (AAAA-MM-DD)"
                  value={form.since}
                  onChangeText={(since) => setForm((p) => ({ ...p, since }))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!saving}
                  accessibilityLabel="Fecha de inicio de la lesión"
                />
                <TextField
                  placeholder="Notas (opcional)"
                  value={form.notes}
                  onChangeText={(notes) => setForm((p) => ({ ...p, notes }))}
                  multiline
                  editable={!saving}
                  accessibilityLabel="Notas"
                />

                <View style={styles.switchRow}>
                  <Txt variant="body">Activa</Txt>
                  <Switch
                    value={form.active}
                    onValueChange={(active) => setForm((p) => ({ ...p, active }))}
                    trackColor={{ true: colors.tint }}
                    accessibilityLabel="Lesión activa"
                  />
                </View>

                {formError ? (
                  <Txt variant="subhead" tone="danger">
                    {formError}
                  </Txt>
                ) : null}

                {editingId !== null ? (
                  <Button
                    title="Borrar lesión"
                    variant="plainDestructive"
                    onPress={confirmDelete}
                    disabled={saving}
                  />
                ) : null}
              </ScrollView>

              <View style={styles.actions}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Cancelar"
                    variant="tinted"
                    size="large"
                    fullWidth
                    disabled={saving}
                    onPress={closeForm}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title={saving ? "Guardando..." : "Guardar"}
                    variant="filled"
                    size="large"
                    fullWidth
                    disabled={saving}
                    onPress={handleSave}
                  />
                </View>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}
