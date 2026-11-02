import { useEffect, useState } from "react";
import { StyleProp, Text, TextStyle } from "react-native";

import { formatClock } from "./SessionBar";

// Reloj de la sesión (mm:ss / h:mm:ss) con su propio tick de 1 s, para que quien
// lo use (píldora flotante, tarjeta de Hoy) no re-renderice nada más cada segundo.
export default function SessionClock({
  startedAt,
  style,
}: {
  startedAt: number;
  style?: StyleProp<TextStyle>;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  return <Text style={style}>{formatClock((now - startedAt) / 1000)}</Text>;
}
