import { View } from "react-native";

import { makeStyles, useTheme } from "../../theme/theme";

const useStyles = makeStyles(({ colors }) => ({
  track: { backgroundColor: colors.fill, overflow: "hidden" },
  fill: {},
}));

type Props = {
  // 0..1
  value: number;
  tone?: "tint" | "water" | "success";
  height?: number;
};

export default function ProgressBar({ value, tone = "tint", height = 8 }: Props) {
  const styles = useStyles();
  const { colors } = useTheme();
  const clamped = Math.max(0, Math.min(1, value));

  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2 }]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <View
        style={{
          height,
          borderRadius: height / 2,
          width: `${clamped * 100}%`,
          backgroundColor: colors[tone],
        }}
      />
    </View>
  );
}
