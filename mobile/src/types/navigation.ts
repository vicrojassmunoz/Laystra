// Stack raíz único: Home es el hub; el resto se empuja con back nativo.
// Ya no hay Tab.Navigator (ROADMAP #10).
export type RootStackParamList = {
  Home: undefined;
  Hoy: undefined;
  Rutinas: undefined;
  Semana: undefined;
  Historial: undefined;
  Progreso: undefined;
  Objetivos: undefined;
  User: undefined;
  Analisis: undefined;
  Agua: undefined;
};

// Patrón oficial de React Navigation: augmenta el tipo global para que
// useNavigation() sin genérico quede tipado en cualquier pantalla.
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
