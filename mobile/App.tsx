import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";

import HistorialScreen from "./src/screens/HistorialScreen";
import ProgressScreen from "./src/screens/ProgressScreen";
import RoutinesScreen from "./src/screens/RoutinesScreen";
import ScheduleScreen from "./src/screens/ScheduleScreen";
import TodayScreen from "./src/screens/TodayScreen";

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="auto" />
        <Tab.Navigator>
          <Tab.Screen name="Hoy" component={TodayScreen} />
          <Tab.Screen name="Rutinas" component={RoutinesScreen} />
          <Tab.Screen name="Semana" component={ScheduleScreen} />
          <Tab.Screen name="Historial" component={HistorialScreen} />
          <Tab.Screen name="Progreso" component={ProgressScreen} />
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
