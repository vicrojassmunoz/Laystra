import * as Haptics from "expo-haptics";
import { ViewStyle } from "react-native";
import { cubicBezier } from "react-native-reanimated";

// Curvas del skill animate-expo (Emil Kowalski). Nada de ease-in en UI.
// OJO: en nativo Reanimated solo acepta como TEXTO las curvas con nombre
// (ease, ease-out...). Una curva propia hay que construirla con cubicBezier();
// el texto "cubic-bezier(...)" funciona en web pero lanza error en el iPhone.
export const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1); // entradas / feedback
export const EASE_IN_OUT = cubicBezier(0.77, 0, 0.175, 1); // movimiento en pantalla

export const PRESS_MS = 120; // feedback de pulsación: 100–150 ms
export const STATE_MS = 200; // cambios de estado pequeños: 150–200 ms
export const VALUE_MS = 380; // una barra de progreso que cambia de valor

// Reanimated 4 acepta propiedades de transición CSS en el style de Animated.*,
// pero los tipos de RN no las conocen: este cast las deja pasar sin `any` suelto.
export function transition(
  properties: string | string[],
  durationMs: number,
  easing: ReturnType<typeof cubicBezier> = EASE_OUT
): ViewStyle {
  return {
    transitionProperty: properties,
    transitionDuration: durationMs,
    transitionTimingFunction: easing,
  } as unknown as ViewStyle;
}

// Hápticos: UNO por acción del usuario, en el instante de la causa, y nunca como
// único feedback (en web / sin motor háptico simplemente no hacen nada).
function safe(run: () => Promise<void>): void {
  try {
    void run().catch(() => {});
  } catch {
    // sin soporte háptico
  }
}

export const haptic = {
  // Un valor "hace clic" al cambiar (chips, selectores).
  tick: () => safe(() => Haptics.selectionAsync()),
  // Algo encaja / se confirma una acción pequeña.
  light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  // Acción de más peso (terminar sesión).
  medium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  // Una operación salió bien (guardar entreno, cumplir objetivo).
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
};
