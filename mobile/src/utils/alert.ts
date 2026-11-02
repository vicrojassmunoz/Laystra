import { Alert, AlertButton, Platform } from "react-native";

// Misma firma que Alert.alert. En iOS/Android delega en el Alert nativo; en web
// (donde react-native-web deja Alert.alert como no-op) usa window.alert /
// window.confirm para que los avisos y confirmaciones sigan funcionando en la
// vista previa del navegador.
export function showAlert(title: string, message?: string, buttons?: AlertButton[]): void {
  if (Platform.OS !== "web") {
    Alert.alert(title, message, buttons);
    return;
  }

  const text = message ? `${title}\n\n${message}` : title;

  // Sin botones, o uno solo: aviso informativo.
  if (!buttons || buttons.length <= 1) {
    window.alert(text);
    buttons?.[0]?.onPress?.();
    return;
  }

  // Confirmación: OK ejecuta la última acción que no sea "cancel"; Cancelar
  // ejecuta el onPress del botón cancel (si lo tiene).
  const cancel = buttons.find((b) => b.style === "cancel");
  const actions = buttons.filter((b) => b.style !== "cancel");
  const confirmed = window.confirm(text);
  if (confirmed) {
    actions[actions.length - 1]?.onPress?.();
  } else {
    cancel?.onPress?.();
  }
}
