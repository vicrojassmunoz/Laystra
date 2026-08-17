import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import AnalisisScreen from "./src/screens/AnalisisScreen";
import HistorialScreen from "./src/screens/HistorialScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ObjetivosScreen from "./src/screens/ObjetivosScreen";
import ProgressScreen from "./src/screens/ProgressScreen";
import RoutinesScreen from "./src/screens/RoutinesScreen";
import ScheduleScreen from "./src/screens/ScheduleScreen";
import TodayScreen from "./src/screens/TodayScreen";
import UserScreen from "./src/screens/UserScreen";
import { RootStackParamList, TabParamList } from "./src/types/navigation";

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

// Tab.Navigator de siempre (Hoy/Rutinas/Semana/Historial/Progreso), con Home
// como pestaña nueva en primera posición.
function Tabs() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Hoy" component={TodayScreen} />
      <Tab.Screen name="Rutinas" component={RoutinesScreen} />
      <Tab.Screen name="Semana" component={ScheduleScreen} />
      <Tab.Screen name="Historial" component={HistorialScreen} />
      <Tab.Screen name="Progreso" component={ProgressScreen} />
    </Tab.Navigator>
  );
}

// Stack raíz: "Tabs" es la app de siempre; Objetivos/User/Analisis son
// pantallas empujadas por encima desde los accesos directos de Home, fuera
// de la tab bar (por eso no son Tab.Screen).
export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Stack.Navigator>
          <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
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
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
