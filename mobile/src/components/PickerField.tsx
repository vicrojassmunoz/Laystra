import DateTimePicker from "@react-native-community/datetimepicker";
import { Platform, View } from "react-native";

import { makeStyles, space } from "../theme/theme";
import { isoOf } from "../utils/date";
import Button from "./ui/Button";
import TextField from "./ui/TextField";
import Txt from "./ui/Txt";

const useStyles = makeStyles(() => ({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 44 },
  grow: { flex: 1 },
}));

type Props = {
  mode: "date" | "time";
  label: string;
  // "AAAA-MM-DD" (date) o "HH:MM" (time); null = sin valor.
  value: string | null;
  onChange: (value: string | null) => void;
};

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toDate(mode: "date" | "time", value: string | null): Date {
  const now = new Date();
  if (!value) return now;
  if (mode === "date") {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const [h, min] = value.split(":").map(Number);
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, min);
}

function fromDate(mode: "date" | "time", d: Date): string {
  return mode === "date"
    ? isoOf(d)
    : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Campo opcional de fecha u hora. Nativo: selector del sistema (calendario /
// rueda de hora) con "Quitar". Web (vista previa): campo de texto AAAA-MM-DD / HH:MM.
export default function PickerField({ mode, label, value, onChange }: Props) {
  const styles = useStyles();

  if (Platform.OS === "web") {
    return (
      <TextField
        placeholder={`${label} ${mode === "date" ? "AAAA-MM-DD" : "HH:MM"} (opcional)`}
        value={value ?? ""}
        onChangeText={(t) => onChange(t.trim() === "" ? null : t.trim())}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityLabel={label}
      />
    );
  }

  return (
    <View style={styles.row}>
      <Txt variant="body" style={styles.grow}>
        {label}
      </Txt>
      {value === null ? (
        <Button
          title={mode === "date" ? "Añadir fecha" : "Añadir hora"}
          variant="tinted"
          size="compact"
          onPress={() => onChange(fromDate(mode, new Date()))}
        />
      ) : (
        <>
          <DateTimePicker
            value={toDate(mode, value)}
            mode={mode}
            // "compact" es solo iOS (la app es solo iOS); en Android se ignora.
            display="compact"
            locale="es-ES"
            // API nueva (onChange está deprecado): onValueChange solo se dispara
            // al elegir un valor, así que ya no hace falta mirar event.type.
            onValueChange={(_e, d) => onChange(fromDate(mode, d))}
          />
          <Button title="Quitar" variant="plain" size="compact" onPress={() => onChange(null)} />
        </>
      )}
    </View>
  );
}
