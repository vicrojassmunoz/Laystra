import { ReactNode, useState } from "react";
import { GestureResponderEvent, Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, { useReducedMotion } from "react-native-reanimated";

import { PRESS_MS, transition } from "../../motion/motion";

type Props = Omit<PressableProps, "children" | "style"> & {
  children: ReactNode;
  // Estilo del contenedor exterior (el área táctil: alignSelf, flex, margen...).
  style?: StyleProp<ViewStyle>;
  // Estilo de la caja que escala (el aspecto visual: fondo, radio, padding).
  boxStyle?: StyleProp<ViewStyle>;
  // Escala al pulsar. 0.97 es el techo para algo que se toca decenas de veces al día.
  scaleTo?: number;
  // Opacidad al pulsar (acompaña a la escala, como los botones del sistema).
  dimTo?: number;
};

// Feedback de pulsación: la respuesta es al PRESIONAR (onPressIn), no al soltar
// -- esperar a que termine el toque se siente muerto. Una transición CSS de
// Reanimated en el hilo de UI; con "reducir movimiento" solo cambia la opacidad.
export default function PressableScale({
  children,
  style,
  boxStyle,
  scaleTo = 0.97,
  dimTo = 0.8,
  onPressIn,
  onPressOut,
  hitSlop = 4,
  pressRetentionOffset = 16,
  ...rest
}: Props) {
  const [pressed, setPressed] = useState(false);
  const reduced = useReducedMotion();

  return (
    <Pressable
      {...rest}
      hitSlop={hitSlop}
      pressRetentionOffset={pressRetentionOffset}
      onPressIn={(e: GestureResponderEvent) => {
        setPressed(true);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        setPressed(false);
        onPressOut?.(e);
      }}
      style={style}
    >
      <Animated.View
        style={[
          boxStyle,
          transition(["transform", "opacity"], PRESS_MS),
          pressed && !reduced ? { transform: [{ scale: scaleTo }] } : { transform: [{ scale: 1 }] },
          pressed ? { opacity: dimTo } : { opacity: 1 },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
