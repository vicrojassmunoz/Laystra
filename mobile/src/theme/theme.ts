import { useMemo } from "react";
import { ImageStyle, StyleSheet, TextStyle, ViewStyle, useColorScheme } from "react-native";

// Laystra — "Native Calm" (ver DESIGN.md). Colores semánticos con la misma
// estructura que los system colors de iOS (grouped background / grouped cell /
// label / separator / fill) para que Modo Oscuro sea un par de valores, no un
// rediseño. UN solo tint (teal) para lo interactivo; verde/ámbar/rojo/azul agua/
// dorado solo llevan significado (estado, aviso, destructivo, agua, récord).
export type Colors = {
  bg: string; // fondo de pantalla (systemGroupedBackground)
  surface: string; // celdas y tarjetas (secondarySystemGroupedBackground)
  surfaceInset: string; // inputs y chips dentro de una superficie
  label: string;
  labelSecondary: string;
  labelTertiary: string;
  separator: string;
  fill: string; // relleno neutro de controles (chips, pistas de progreso)
  tint: string;
  onTint: string; // texto/icono sobre el tint
  tintSoft: string; // botón "tinted"
  success: string;
  successSoft: string;
  danger: string;
  dangerSoft: string;
  warning: string;
  warningSoft: string;
  water: string;
  waterSoft: string;
  gold: string;
  goldSoft: string;
};

const light: Colors = {
  bg: "#F2F2F7",
  surface: "#FFFFFF",
  surfaceInset: "#F2F2F7",
  label: "#000000",
  labelSecondary: "rgba(60,60,67,0.62)",
  labelTertiary: "rgba(60,60,67,0.32)",
  separator: "rgba(60,60,67,0.18)",
  fill: "rgba(120,120,128,0.12)",
  tint: "#0B7F73",
  onTint: "#FFFFFF",
  tintSoft: "rgba(11,127,115,0.12)",
  success: "#1E8E3E",
  successSoft: "rgba(30,142,62,0.14)",
  danger: "#D70015",
  dangerSoft: "rgba(215,0,21,0.10)",
  warning: "#A35A00",
  warningSoft: "rgba(163,90,0,0.14)",
  water: "#0A6BC4",
  waterSoft: "rgba(10,107,196,0.12)",
  gold: "#8A5C00",
  goldSoft: "rgba(138,92,0,0.14)",
};

const dark: Colors = {
  bg: "#000000",
  surface: "#1C1C1E",
  surfaceInset: "#2C2C2E",
  label: "#FFFFFF",
  labelSecondary: "rgba(235,235,245,0.62)",
  labelTertiary: "rgba(235,235,245,0.30)",
  separator: "rgba(84,84,88,0.65)",
  fill: "rgba(120,120,128,0.24)",
  tint: "#3FD0BF",
  onTint: "#00201C",
  tintSoft: "rgba(63,208,191,0.18)",
  success: "#32D74B",
  successSoft: "rgba(50,215,75,0.18)",
  danger: "#FF453A",
  dangerSoft: "rgba(255,69,58,0.18)",
  warning: "#FF9F0A",
  warningSoft: "rgba(255,159,10,0.18)",
  water: "#64B5FF",
  waterSoft: "rgba(100,181,255,0.18)",
  gold: "#FFD60A",
  goldSoft: "rgba(255,214,10,0.16)",
};

// Estilos de texto de iOS (tamaño/interlineado/peso de las HIG). Sin fontFamily:
// RN usa San Francisco en iOS y sigue Dynamic Type automáticamente.
export type TypeStyle = Pick<TextStyle, "fontSize" | "lineHeight" | "fontWeight" | "letterSpacing">;

export const type = {
  largeTitle: { fontSize: 34, lineHeight: 41, fontWeight: "700", letterSpacing: 0.3 },
  title1: { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: 0.3 },
  title2: { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: 0.3 },
  title3: { fontSize: 20, lineHeight: 25, fontWeight: "600", letterSpacing: 0.3 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600", letterSpacing: -0.4 },
  body: { fontSize: 17, lineHeight: 22, fontWeight: "400", letterSpacing: -0.4 },
  callout: { fontSize: 16, lineHeight: 21, fontWeight: "400", letterSpacing: -0.3 },
  subhead: { fontSize: 15, lineHeight: 20, fontWeight: "400", letterSpacing: -0.2 },
  footnote: { fontSize: 13, lineHeight: 18, fontWeight: "400", letterSpacing: -0.1 },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "400", letterSpacing: 0 },
} as const satisfies Record<string, TypeStyle>;

export type TypeVariant = keyof typeof type;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const radius = { control: 10, card: 12, pill: 999 } as const;
// Mínimo táctil de las HIG (pt).
export const TOUCH = 44;

export type Theme = {
  colors: Colors;
  isDark: boolean;
};

export function useTheme(): Theme {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  return useMemo(() => ({ colors: isDark ? dark : light, isDark }), [isDark]);
}

export const palettes = { light, dark };

// Hoja de estilos que depende del tema: `const useStyles = makeStyles((t) => ({...}))`
// y dentro del componente `const styles = useStyles()`.
type StyleMap = Record<string, ViewStyle | TextStyle | ImageStyle>;

export function makeStyles<T extends StyleMap>(factory: (theme: Theme) => T) {
  return function useStyles(): T {
    const theme = useTheme();
    return useMemo(() => StyleSheet.create(factory(theme)) as T, [theme]);
  };
}
