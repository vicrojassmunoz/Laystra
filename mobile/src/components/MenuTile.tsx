import { StyleSheet, Text, TouchableOpacity } from "react-native";

type Props = {
  label: string;
  onPress: () => void;
  variant: "fullWidth" | "half";
};

// Botón de acceso rápido usado en la pantalla Home. "half" se usa en pareja
// (dos tiles en la misma fila, ver HomeScreen) y "fullWidth" ocupa la fila entera.
export default function MenuTile({ label, onPress, variant }: Props) {
  return (
    <TouchableOpacity
      style={[styles.tile, variant === "half" ? styles.half : styles.fullWidth]}
      onPress={onPress}
    >
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  tile: {
    backgroundColor: "#f4f4f4",
    borderRadius: 8,
    paddingVertical: 20,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fullWidth: {
    width: "100%",
  },
  half: {
    flex: 1,
  },
  label: {
    fontSize: 16,
    fontWeight: "600",
  },
});
