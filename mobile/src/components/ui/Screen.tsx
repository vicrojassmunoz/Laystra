import { ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { makeStyles, space, useTheme } from "../../theme/theme";
import Txt from "./Txt";

const useStyles = makeStyles(({ colors }) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, paddingBottom: space.xxxl * 2, gap: space.lg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.sm },
}));

type Props = {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
};

// Pantalla con scroll, fondo del tema y los insets que iOS espera. El título va
// en la cabecera nativa (en línea, centrado), no en el cuerpo.
export default function Screen({ children, contentStyle }: Props) {
  const styles = useStyles();

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={styles.root}
        contentContainerStyle={[styles.content, contentStyle]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Estados de pantalla completa (cargando / error de conexión).
export function ScreenLoading() {
  const styles = useStyles();
  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    </SafeAreaView>
  );
}

export function ScreenError({ message }: { message: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <SafeAreaView style={styles.root} edges={["bottom"]}>
      <View style={styles.center}>
        <Txt variant="title3" style={{ textAlign: "center" }}>
          No se pudo conectar con el backend
        </Txt>
        <Txt variant="subhead" style={{ textAlign: "center", color: colors.danger }}>
          {message}
        </Txt>
      </View>
    </SafeAreaView>
  );
}
