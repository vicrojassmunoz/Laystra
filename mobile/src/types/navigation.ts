import { NavigatorScreenParams } from "@react-navigation/native";

// Tabs de siempre (bottom-tabs), ahora anidadas dentro del stack raíz.
export type TabParamList = {
  Home: undefined;
  Hoy: undefined;
  Rutinas: undefined;
  Semana: undefined;
  Historial: undefined;
  Progreso: undefined;
};

// Stack raíz: la pantalla "Tabs" contiene el Tab.Navigator de siempre, y
// las demás son pantallas "empujadas" por encima (placeholders v1).
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  Objetivos: undefined;
  User: undefined;
  Analisis: undefined;
};

// Patrón oficial de React Navigation: augmenta el tipo global para que
// useNavigation() sin genérico quede tipado en cualquier pantalla, a
// cualquier profundidad (tabs incluidas), sin tener que elegir a mano entre
// NativeStackNavigationProp/BottomTabNavigationProp en cada screen.
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
