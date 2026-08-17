import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Button,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { createBodyMetric, deleteBodyMetric, fetchBodyMetrics } from "../api/bodyMetrics";
import { todayIsoDate } from "../api/today";
import { BodyMetric } from "../types/bodyMetric";
import { parseDecimalInput } from "../utils/number";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; metrics: BodyMetric[] };

// Perfil: registro de peso corporal / %grasa. El backend no tiene PUT para
// BodyMetric -- solo alta/lista/borrado, así que a diferencia de
// RoutinesScreen aquí no hay modo edición ni editingId.
export default function UserScreen() {
  const [state, setState] = useState<State>({ status: "loading" });
  const hasDataRef = useRef(false);

  const [date, setDate] = useState(todayIsoDate());
  const [weight, setWeight] = useState("");
  const [bodyFatPct, setBodyFatPct] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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

  // Corre cada vez que esta pantalla gana foco (no solo al montar) -- igual
  // que el resto de pantallas de la app, aunque esta viva fuera del
  // Tab.Navigator (pusheada desde Home): useFocusEffect también dispara al
  // volver de un back nativo.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  function confirmDelete(metric: BodyMetric) {
    Alert.alert(
      "¿Borrar registro?",
      `Se borrará el registro del ${metric.date} permanentemente.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Borrar",
          style: "destructive",
          onPress: () => handleDelete(metric.id),
        },
      ]
    );
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
    // Esto solo evita mandar algo que ni de lejos tiene forma de fecha.
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

  const { metrics } = state;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Esta pantalla vive en el Stack raíz (pusheada desde Home), no dentro
          del Tab.Navigator -- no hay tab bar debajo que compensar, así que a
          diferencia de RoutinasScreen/TodayScreen/HistorialScreen no se usa
          useBottomTabBarHeight() como offset (fallaría: no hay
          BottomTabBarHeightContext fuera de un Tab.Navigator). Mismo criterio
          que ya usan los <Modal> de RoutinesScreen, que también viven "fuera"
          de la tab bar: offset 0 basta. */}
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Sin título propio: esta pantalla vive en el Stack raíz (pusheada
              desde Home), cuyo header nativo ya muestra "Perfil" (ver
              App.tsx) -- pintarlo también aquí era redundante. */}
          {metrics.length === 0 && (
            <Text style={styles.emptyText}>Todavía no hay registros de peso.</Text>
          )}

          {actionError && <Text style={styles.errorDetail}>{actionError}</Text>}

          {metrics.map((metric) => (
            <View key={metric.id} style={styles.card}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardDate}>{metric.date}</Text>
                <Text style={styles.cardWeight}>
                  {metric.weight} kg
                  {metric.body_fat_pct !== null ? ` · ${metric.body_fat_pct}% grasa` : ""}
                </Text>
              </View>
              <Button title="Borrar" color="#b00020" onPress={() => confirmDelete(metric)} />
            </View>
          ))}

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Nuevo registro</Text>

            <TextInput
              style={styles.input}
              placeholder="AAAA-MM-DD"
              value={date}
              onChangeText={setDate}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TextInput
              style={styles.input}
              placeholder="Peso (kg)"
              keyboardType="decimal-pad"
              value={weight}
              onChangeText={setWeight}
            />

            <TextInput
              style={styles.input}
              placeholder="%grasa (opcional)"
              keyboardType="decimal-pad"
              value={bodyFatPct}
              onChangeText={setBodyFatPct}
            />

            {formError && <Text style={styles.errorDetail}>{formError}</Text>}

            <View style={styles.saveButton}>
              <Button
                title={saving ? "Guardando..." : "Guardar registro"}
                onPress={handleSave}
                disabled={saving}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  emptyText: {
    fontSize: 16,
    color: "#555",
    marginBottom: 16,
  },
  card: {
    backgroundColor: "#f4f4f4",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardInfo: {
    flex: 1,
  },
  cardDate: {
    fontSize: 14,
    color: "#555",
  },
  cardWeight: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 2,
  },
  formCard: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#ddd",
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 10,
    fontSize: 16,
    marginBottom: 12,
  },
  saveButton: {
    marginTop: 4,
  },
  errorDetail: {
    fontSize: 14,
    color: "#b00020",
    marginTop: 8,
  },
});
