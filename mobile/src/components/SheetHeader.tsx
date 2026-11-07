import { View } from "react-native";

import { makeStyles, space } from "../theme/theme";
import Button from "./ui/Button";
import Txt from "./ui/Txt";

type Props = {
  title: string;
  onClose: () => void;
};

// Cabecera de hoja modal: título centrado y botón "Cerrar" siempre visible
// arriba a la derecha. Vive fuera de cualquier ScrollView, así que con el
// teclado abierto el primer toque ya cierra (no hace falta descartar el teclado).
export default function SheetHeader({ title, onClose }: Props) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={styles.side} />
      <Txt variant="title3" style={styles.title} numberOfLines={2}>
        {title}
      </Txt>
      <View style={[styles.side, styles.sideEnd]}>
        <Button title="Cerrar" variant="plain" size="compact" onPress={onClose} />
      </View>
    </View>
  );
}

const useStyles = makeStyles(() => ({
  row: { flexDirection: "row", alignItems: "center", marginBottom: space.md },
  side: { width: 76 },
  sideEnd: { alignItems: "flex-end" },
  title: { flex: 1, textAlign: "center" },
}));
