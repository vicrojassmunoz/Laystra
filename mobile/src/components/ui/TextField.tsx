import { StyleProp, TextInput, TextInputProps, TextStyle } from "react-native";

import { TOUCH, makeStyles, radius, space, type, useTheme } from "../../theme/theme";

const useStyles = makeStyles(({ colors }) => ({
  input: {
    ...type.body,
    minHeight: TOUCH,
    // minWidth: 0 evita que el <input> web imponga su ancho intrínseco y
    // aplaste a sus vecinos en una fila flex.
    minWidth: 0,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    borderRadius: radius.control,
    borderCurve: "continuous",
    backgroundColor: colors.surfaceInset,
    color: colors.label,
  },
  multiline: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" },
}));

type Props = TextInputProps & {
  style?: StyleProp<TextStyle>;
};

// Campo de texto de la app (≥44 pt, fondo de inset, tipografía body). Pensado
// para ir DENTRO de una Card (la Card es surface, el campo es surfaceInset).
export default function TextField({ style, multiline, ...rest }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.labelTertiary}
      selectionColor={colors.tint}
      multiline={multiline}
      {...rest}
      style={[styles.input, multiline && styles.multiline, style]}
    />
  );
}
