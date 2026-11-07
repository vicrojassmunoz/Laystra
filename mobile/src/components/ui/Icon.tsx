import { Ionicons } from "@expo/vector-icons";
import { SFSymbol, SymbolView } from "expo-symbols";
import { Platform, StyleProp, ViewStyle } from "react-native";

// Un solo sistema de iconos: SF Symbols en iOS (lo que espera la plataforma) y,
// solo para la vista previa en navegador / otras plataformas, el Ionicon más
// parecido. Los nombres de la app son semánticos (qué significa, no cómo se dibuja).
const ICONS = {
  train: { sf: "figure.strengthtraining.traditional", ion: "barbell-outline" },
  water: { sf: "drop.fill", ion: "water" },
  history: { sf: "clock.arrow.circlepath", ion: "time-outline" },
  routines: { sf: "list.bullet.rectangle", ion: "list-outline" },
  progress: { sf: "chart.line.uptrend.xyaxis", ion: "trending-up" },
  habits: { sf: "checklist", ion: "checkbox-outline" },
  goals: { sf: "target", ion: "flag-outline" },
  profile: { sf: "person.crop.circle", ion: "person-circle-outline" },
  analysis: { sf: "chart.bar.xaxis", ion: "bar-chart-outline" },
  steps: { sf: "figure.walk", ion: "walk-outline" },
  week: { sf: "calendar", ion: "calendar-outline" },
  chevron: { sf: "chevron.right", ion: "chevron-forward" },
  play: { sf: "play.fill", ion: "play" },
  pause: { sf: "pause.fill", ion: "pause" },
  stop: { sf: "stop.fill", ion: "stop" },
  note: { sf: "note.text", ion: "document-text-outline" },
  trophy: { sf: "trophy.fill", ion: "trophy" },
  volume: { sf: "bolt.fill", ion: "flash" },
  quick: { sf: "bolt.fill", ion: "flash" },
  tip: { sf: "lightbulb", ion: "bulb-outline" },
  check: { sf: "checkmark.circle.fill", ion: "checkmark-circle" },
  plus: { sf: "plus", ion: "add" },
  minus: { sf: "minus", ion: "remove" },
  info: { sf: "info.circle", ion: "information-circle-outline" },
  rest: { sf: "timer", ion: "timer-outline" },
  expand: { sf: "chevron.down", ion: "chevron-down" },
  collapse: { sf: "chevron.up", ion: "chevron-up" },
  remove: { sf: "minus.circle", ion: "remove-circle-outline" },
  circle: { sf: "circle", ion: "ellipse-outline" },
} as const satisfies Record<string, { sf: SFSymbol; ion: keyof typeof Ionicons.glyphMap }>;

export type IconName = keyof typeof ICONS;

type Props = {
  name: IconName;
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
};

export default function Icon({ name, size = 20, color, style }: Props) {
  const icon = ICONS[name];

  if (Platform.OS === "ios") {
    return (
      <SymbolView
        name={icon.sf}
        size={size}
        tintColor={color}
        weight="medium"
        resizeMode="scaleAspectFit"
        style={[{ width: size, height: size }, style]}
      />
    );
  }

  return <Ionicons name={icon.ion} size={size} color={color} style={style as never} />;
}
