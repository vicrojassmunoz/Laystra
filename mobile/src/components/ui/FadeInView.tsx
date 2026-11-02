import { ReactNode } from "react";
import { StyleProp, ViewStyle } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

// Contenido que aparece al desplegar algo (detalle de un entreno / rutina): solo
// un fundido de 120 ms. Sin animar la altura -- estas tarjetas se abren muchas
// veces al día, así que el movimiento tiene que ser casi imperceptible.
export default function FadeInView({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View entering={FadeIn.duration(120)} style={style}>
      {children}
    </Animated.View>
  );
}
