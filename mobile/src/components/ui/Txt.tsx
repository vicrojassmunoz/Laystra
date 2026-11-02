import { StyleProp, Text, TextProps, TextStyle } from "react-native";

import { TypeVariant, type, useTheme } from "../../theme/theme";

export type Tone =
  | "label"
  | "secondary"
  | "tertiary"
  | "tint"
  | "onTint"
  | "danger"
  | "success"
  | "warning"
  | "water"
  | "gold";

type Props = TextProps & {
  variant?: TypeVariant;
  tone?: Tone;
  // Cifras tabulares: relojes y totales no "bailan" al cambiar los dígitos.
  numeric?: boolean;
  weight?: TextStyle["fontWeight"];
  style?: StyleProp<TextStyle>;
};

// Texto con los estilos de iOS (type) y colores semánticos del tema. Todo texto
// nuevo de la app pasa por aquí para que Modo Oscuro y la jerarquía sean coherentes.
export default function Txt({
  variant = "body",
  tone = "label",
  numeric = false,
  weight,
  style,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const color =
    tone === "label"
      ? colors.label
      : tone === "secondary"
        ? colors.labelSecondary
        : tone === "tertiary"
          ? colors.labelTertiary
          : colors[tone];

  return (
    <Text
      {...rest}
      style={[
        type[variant],
        { color },
        weight ? { fontWeight: weight } : null,
        numeric ? { fontVariant: ["tabular-nums"] } : null,
        style,
      ]}
    />
  );
}
