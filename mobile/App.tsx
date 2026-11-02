import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  Theme as NavTheme,
  createNavigationContainerRef,
} from "@react-navigation/native";
import { NativeStackNavigationOptions, createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import SessionPill from "./src/components/SessionPill";
import AguaScreen from "./src/screens/AguaScreen";
import AnalisisScreen from "./src/screens/AnalisisScreen";
import HistorialScreen from "./src/screens/HistorialScreen";
import HomeScreen from "./src/screens/HomeScreen";
import HoyScreen from "./src/screens/HoyScreen";
import ObjetivosScreen from "./src/screens/ObjetivosScreen";
import ProgressScreen from "./src/screens/ProgressScreen";
import RoutinesScreen from "./src/screens/RoutinesScreen";
import ScheduleScreen from "./src/screens/ScheduleScreen";
import SesionScreen from "./src/screens/SesionScreen";
import UserScreen from "./src/screens/UserScreen";
import { SessionProvider } from "./src/session/SessionContext";
import { restoreAppearance } from "./src/theme/appearance";
import { useTheme } from "./src/theme/theme";
import { RootStackParamList } from "./src/types/navigation";

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Home es la única pantalla raíz (hub). Hoy/Rutinas/Semana/Historial/Progreso
// y Objetivos/User/Analisis se empujan encima con el back nativo del stack —
// sin bottom tab bar (ROADMAP #10; decisión: tile grande "Hoy" en Home).
function Root() {
  const { colors, isDark } = useTheme();
  // Ruta visible, para ocultar la píldora de sesión en la propia pantalla Sesión.
  const [currentRoute, setCurrentRoute] = useState<string | undefined>();
  const syncRoute = () => setCurrentRoute(navigationRef.getCurrentRoute()?.name);

  const navTheme = useMemo<NavTheme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.tint,
        background: colors.bg,
        card: colors.bg,
        text: colors.label,
        border: colors.separator,
      },
    };
  }, [colors, isDark]);

  // Cabecera nativa de iOS: sin sombra, mismo fondo que la pantalla, solo el
  // chevron en el back, y el tint de la app para lo interactivo.
  const screenOptions = useMemo<NativeStackNavigationOptions>(
    () => ({
      headerShadowVisible: false,
      headerStyle: { backgroundColor: colors.bg },
      headerTintColor: colors.tint,
      headerTitleStyle: { color: colors.label },
      headerBackButtonDisplayMode: "minimal",
      contentStyle: { backgroundColor: colors.bg },
    }),
    [colors]
  );


  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navTheme}
      onReady={syncRoute}
      onStateChange={syncRoute}
    >
      <StatusBar style="auto" />
      <Stack.Navigator initialRouteName="Home" screenOptions={screenOptions}>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "Laystra" }} />
        <Stack.Screen name="Hoy" component={HoyScreen} options={{ title: "Hoy" }} />
        <Stack.Screen name="Sesion" component={SesionScreen} options={{ title: "Sesión" }} />
        <Stack.Screen name="Rutinas" component={RoutinesScreen} options={{ title: "Rutinas" }} />
        <Stack.Screen name="Semana" component={ScheduleScreen} options={{ title: "Semana" }} />
        <Stack.Screen name="Historial" component={HistorialScreen} options={{ title: "Historial" }} />
        <Stack.Screen name="Progreso" component={ProgressScreen} options={{ title: "Progreso" }} />
        <Stack.Screen name="Objetivos" component={ObjetivosScreen} options={{ title: "Objetivos" }} />
        <Stack.Screen name="User" component={UserScreen} options={{ title: "Perfil" }} />
        <Stack.Screen name="Analisis" component={AnalisisScreen} options={{ title: "Análisis" }} />
        <Stack.Screen name="Agua" component={AguaScreen} options={{ title: "Agua" }} />
      </Stack.Navigator>
      <SessionPill
        currentRoute={currentRoute}
        onPress={() => navigationRef.isReady() && navigationRef.navigate("Sesion")}
      />
    </NavigationContainer>
  );
}

export default function App() {
  // Restaura la preferencia de apariencia guardada (Sistema / Claro / Oscuro).
  useEffect(() => {
    void restoreAppearance();
  }, []);

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <Root />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
