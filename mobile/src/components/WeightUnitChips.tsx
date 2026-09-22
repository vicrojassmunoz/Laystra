import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { WeightUnit } from "../types/exercise";
import { formatWeightUnit } from "../utils/weightUnit";

const OPTIONS: { value: WeightUnit; label: string }[] = [
  { value: "kg", label: "kg" },
  { value: "lb", label: "lb" },
  { value: "bw", label: "PC" },
];

type ChipsProps = {
  value: WeightUnit;
  onChange: (unit: WeightUnit) => void;
  disabled?: boolean;
};

export function WeightUnitChips({ value, onChange, disabled }: ChipsProps) {
  return (
    <View style={styles.row}>
      {OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.chip, selected && styles.chipSelected]}
            onPress={() => onChange(option.value)}
            disabled={disabled}
          >
            <Text style={selected ? styles.chipTextSelected : styles.chipText}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
      {value === "bw" && (
        <TouchableOpacity
          style={styles.infoButton}
          onPress={() =>
            Alert.alert(
              "Peso corporal (PC)",
              "PC registra la serie como peso corporal. Si tienes un peso en Perfil, se usa el último al guardar. Si no, se guarda solo como PC."
            )
          }
          disabled={disabled}
          hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
        >
          <Text style={styles.infoText}>i</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

type LockedProps = {
  bodyWeightKg: number | null;
};

export function LockedBodyweightLabel({ bodyWeightKg }: LockedProps) {
  return (
    <View style={styles.locked}>
      <Text style={styles.lockedText}>
        {bodyWeightKg != null && bodyWeightKg > 0 ? `PC · ${bodyWeightKg} kg` : "PC"}
      </Text>
    </View>
  );
}

export function formatSetLine(weight: number, unit: string, reps: number): string {
  if (unit === "bw") {
    const extra = weight > 0 ? ` · ${weight} kg` : "";
    return `PC${extra} x ${reps}`;
  }
  return `${weight}${formatWeightUnit(unit)} x ${reps}`;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipSelected: {
    borderColor: "#3b5bdb",
    backgroundColor: "#3b5bdb",
  },
  chipText: {
    fontSize: 13,
    color: "#333",
  },
  chipTextSelected: {
    fontSize: 13,
    color: "#fff",
    fontWeight: "600",
  },
  infoButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: "#3b5bdb",
    alignItems: "center",
    justifyContent: "center",
  },
  infoText: {
    fontSize: 13,
    color: "#3b5bdb",
    fontWeight: "700",
  },
  locked: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    backgroundColor: "#eee",
  },
  lockedText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
  },
});
