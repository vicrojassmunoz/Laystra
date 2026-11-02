import { useEffect, useState } from "react";
import { StyleProp, TextStyle } from "react-native";

import { TypeVariant } from "../theme/theme";
import { formatClock } from "./SessionBar";
import Txt, { Tone } from "./ui/Txt";

// Reloj de la sesión (mm:ss / h:mm:ss) con su propio tick de 1 s, para que quien
// lo use (píldora flotante, tarjeta de Hoy) no re-renderice nada más cada segundo.
export default function SessionClock({
  startedAt,
  pausedAt = null,
  variant = "title2",
  tone = "label",
  style,
}: {
  startedAt: number;
  variant?: TypeVariant;
  tone?: Tone;
  // Con pausa el reloj se congela en el instante en que se pausó.
  pausedAt?: number | null;
  style?: StyleProp<TextStyle>;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (pausedAt !== null) {
      return;
    }
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt, pausedAt]);

  return (
    <Txt variant={variant} tone={tone} numeric weight="700" style={style}>
      {formatClock(((pausedAt ?? now) - startedAt) / 1000)}
    </Txt>
  );
}
