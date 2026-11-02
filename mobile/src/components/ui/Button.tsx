import { Pressable, StyleProp, View, ViewStyle } from "react-native";

import { TOUCH, makeStyles, radius, space, useTheme } from "../../theme/theme";
import Icon, { IconName } from "./Icon";
import Txt from "./Txt";

const useStyles = makeStyles(({ colors }) => ({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderCurve: "continuous",
  },
  large: { minHeight: 50, paddingHorizontal: space.xl, borderRadius: radius.card },
  regular: { minHeight: TOUCH, paddingHorizontal: space.lg, borderRadius: radius.control },
  // "compact" se ve pequeño pero conserva el área táctil de 44 pt vía hitSlop.
  compact: { minHeight: 34, paddingHorizontal: space.md, borderRadius: radius.control },
  filled: { backgroundColor: colors.tint },
  tinted: { backgroundColor: colors.tintSoft },
  plain: { backgroundColor: "transparent" },
  destructive: { backgroundColor: colors.dangerSoft },
  plainDestructive: { backgroundColor: "transparent" },
  iconOnly: { minWidth: TOUCH, paddingHorizontal: 0 },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.6 },
  full: { alignSelf: "stretch" },
}));

type Variant = "filled" | "tinted" | "plain" | "destructive" | "plainDestructive";

type Props = {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: "large" | "regular" | "compact";
  icon?: IconName;
  disabled?: boolean;
  fullWidth?: boolean;
  // Solo icono (el título pasa a ser la etiqueta de accesibilidad).
  iconOnly?: boolean;
  style?: StyleProp<ViewStyle>;
};

// Botón de acción. filled = acción principal de la pantalla (una por pantalla);
// tinted = acción secundaria; plain = terciaria; destructive = borrar/descartar.
export default function Button({
  title,
  onPress,
  variant = "tinted",
  size = "regular",
  icon,
  disabled = false,
  fullWidth = false,
  iconOnly = false,
  style,
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();

  const textColor =
    variant === "filled"
      ? colors.onTint
      : variant === "destructive" || variant === "plainDestructive"
        ? colors.danger
        : colors.tint;

  const verticalSlop = size === "compact" ? 5 : 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={iconOnly ? title : undefined}
      accessibilityState={{ disabled }}
      hitSlop={{ top: verticalSlop, bottom: verticalSlop, left: 4, right: 4 }}
      style={({ pressed }) => [
        styles.base,
        styles[size],
        styles[variant],
        fullWidth && styles.full,
        iconOnly && styles.iconOnly,
        disabled && styles.disabled,
        pressed && styles.pressed,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={size === "compact" ? 15 : 18} color={textColor} /> : null}
      {iconOnly ? null : (
      <View>
        <Txt
          variant={size === "compact" ? "subhead" : size === "large" ? "headline" : "callout"}
          weight="600"
          style={{ color: textColor }}
        >
          {title}
        </Txt>
      </View>
      )}
    </Pressable>
  );
}
