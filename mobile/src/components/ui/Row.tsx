import { ReactNode } from "react";
import { Pressable, View } from "react-native";

import { TOUCH, makeStyles, space, useTheme } from "../../theme/theme";
import Icon, { IconName } from "./Icon";
import Txt, { Tone } from "./Txt";

const useStyles = makeStyles(({ colors }) => ({
  row: {
    minHeight: TOUCH,
    paddingVertical: 11,
    paddingHorizontal: space.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
  },
  pressed: { backgroundColor: colors.fill },
  text: { flex: 1, gap: 1 },
  trailing: { flexDirection: "row", alignItems: "center", gap: space.sm },
}));

type Props = {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconTone?: Tone;
  // Texto o nodo a la derecha (valor, badge...).
  value?: ReactNode;
  onPress?: () => void;
  // Por defecto, una fila tocable muestra chevron.
  chevron?: boolean;
  titleTone?: Tone;
};

// Fila de lista agrupada (≥44 pt). Con onPress es un botón con estado pulsado.
export default function Row({
  title,
  subtitle,
  icon,
  iconTone = "tint",
  value,
  onPress,
  chevron,
  titleTone = "label",
}: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const showChevron = chevron ?? onPress !== undefined;

  const toneColor = (tone: Tone) =>
    tone === "label"
      ? colors.label
      : tone === "secondary"
        ? colors.labelSecondary
        : tone === "tertiary"
          ? colors.labelTertiary
          : colors[tone];

  const content = (
    <>
      {icon ? <Icon name={icon} size={22} color={toneColor(iconTone)} /> : null}
      <View style={styles.text}>
        <Txt variant="body" tone={titleTone}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="footnote" tone="secondary">
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {value !== undefined || showChevron ? (
        <View style={styles.trailing}>
          {typeof value === "string" || typeof value === "number" ? (
            <Txt variant="body" tone="secondary" numeric>
              {value}
            </Txt>
          ) : (
            value
          )}
          {showChevron ? <Icon name="chevron" size={14} color={colors.labelTertiary} /> : null}
        </View>
      ) : null}
    </>
  );

  if (!onPress) {
    return <View style={styles.row}>{content}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}
