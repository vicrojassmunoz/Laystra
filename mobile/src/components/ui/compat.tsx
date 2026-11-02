import { Text as RNText, TextInput as RNTextInput, TextInputProps, TextProps } from "react-native";

import { radius, useTheme } from "../../theme/theme";
import BaseButton from "./Button";

// Sustitutos "drop-in" de Text / TextInput / Button de react-native para las
// pantallas antiguas que aún no se han rediseñado a mano: misma API, pero con los
// colores del tema (Modo Oscuro) y el aspecto del sistema de diseño. Las pantallas
// nuevas usan Txt / TextField / Button de components/ui directamente.

export function Text({ style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return <RNText {...rest} style={[{ color: colors.label }, style]} />;
}

export function TextInput({ style, ...rest }: TextInputProps) {
  const { colors } = useTheme();
  return (
    <RNTextInput
      placeholderTextColor={colors.labelTertiary}
      selectionColor={colors.tint}
      {...rest}
      style={[
        {
          color: colors.label,
          backgroundColor: colors.surfaceInset,
          borderRadius: radius.control,
          minHeight: 44,
          minWidth: 0,
        },
        style,
      ]}
    />
  );
}

type ButtonProps = {
  title: string;
  onPress: () => void;
  // Mismo contrato que el Button nativo: un color rojo = destructivo, gris = secundario.
  color?: string;
  disabled?: boolean;
};

export function Button({ title, onPress, color, disabled }: ButtonProps) {
  const variant =
    color === undefined
      ? "tinted"
      : color.toLowerCase() === "#b00020"
        ? "destructive"
        : color.toLowerCase() === "#666" || color.toLowerCase() === "#666666"
          ? "plain"
          : "tinted";
  return <BaseButton title={title} onPress={onPress} variant={variant} disabled={disabled} />;
}
