import { Children, ReactNode, isValidElement } from "react";
import { StyleProp, View, ViewStyle } from "react-native";

import { makeStyles, radius, space } from "../../theme/theme";
import Txt from "./Txt";

const useStyles = makeStyles(({ colors }) => ({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderCurve: "continuous",
    overflow: "hidden",
  },
  padded: { padding: space.lg, gap: space.sm },
  header: { paddingHorizontal: space.lg + 4, marginBottom: space.sm },
  footer: { paddingHorizontal: space.lg + 4, marginTop: space.sm },
  separator: {
    height: 1,
    backgroundColor: colors.separator,
    marginLeft: space.lg,
    opacity: 0.9,
  },
}));

// Superficie agrupada (secondarySystemGroupedBackground). Una sola elevación:
// el cambio de fondo contra la pantalla, sin sombra ni borde. Nunca anidar tarjetas.
export function Card({
  children,
  padded = true,
  style,
}: {
  children: ReactNode;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return <View style={[styles.card, padded && styles.padded, style]}>{children}</View>;
}

// Encabezado de sección estilo iOS (footnote, secundario).
export function SectionHeader({ children }: { children: string }) {
  const styles = useStyles();
  return (
    <View style={styles.header}>
      <Txt variant="footnote" tone="secondary" weight="600">
        {children}
      </Txt>
    </View>
  );
}

// Lista agrupada estilo iOS: encabezado opcional, filas con separador de 1px
// con sangría y pie opcional. Los hijos suelen ser <Row/>.
export function Section({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  const styles = useStyles();
  const items = Children.toArray(children).filter(isValidElement);

  return (
    <View>
      {title ? <SectionHeader>{title}</SectionHeader> : null}
      <Card padded={false}>
        {items.map((child, index) => (
          <View key={index}>
            {index > 0 ? <View style={styles.separator} /> : null}
            {child}
          </View>
        ))}
      </Card>
      {footer ? (
        <View style={styles.footer}>
          <Txt variant="footnote" tone="secondary">
            {footer}
          </Txt>
        </View>
      ) : null}
    </View>
  );
}
