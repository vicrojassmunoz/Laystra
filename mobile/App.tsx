import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AguaScreen from "./src/screens/AguaScreen";
import AnalisisScreen from "./src/screens/AnalisisScreen";
import HistorialScreen from "./src/screens/HistorialScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ObjetivosScreen from "./src/screens/ObjetivosScreen";
import ProgressScreen from "./src/screens/ProgressScreen";
import RoutinesScreen from "./src/screens/RoutinesScreen";
import ScheduleScreen from "./src/screens/ScheduleScreen";
import TodayScreen from "./src/screens/TodayScreen";
import UserScreen from "./src/screens/UserScreen";
import { RootStackParamList } from "./src/types/navigation";

const Stack = createNativeStackNavigator<RootStackParamList>();

// Home es la única pantalla raíz (hub). Hoy/Rutinas/Semana/Historial/Progreso
// y Objetivos/User/Analisis se empujan encima con el back nativo del stack —
// sin bottom tab bar (ROADMAP #10; decisión: tile grande "Hoy" en Home).
export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator initialRouteName="Home">
          <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Hoy" component={TodayScreen} options={{ title: "Hoy" }} />
          <Stack.Screen name="Rutinas" component={RoutinesScreen} options={{ title: "Rutinas" }} />
          <Stack.Screen name="Semana" component={ScheduleScreen} options={{ title: "Semana" }} />
          <Stack.Screen
            name="Historial"
            component={HistorialScreen}
            options={{ title: "Historial" }}
          />
          <Stack.Screen
            name="Progreso"
            component={ProgressScreen}
            options={{ title: "Progreso" }}
          />
          <Stack.Screen
            name="Objetivos"
            component={ObjetivosScreen}
            options={{ title: "Objetivos" }}
          />
          <Stack.Screen name="User" component={UserScreen} options={{ title: "Perfil" }} />
          <Stack.Screen
            name="Analisis"
            component={AnalisisScreen}
            options={{ title: "Análisis" }}
          />
          <Stack.Screen name="Agua" component={AguaScreen} options={{ title: "Agua" }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
