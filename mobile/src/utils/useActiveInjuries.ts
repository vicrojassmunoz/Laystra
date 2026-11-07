import { useEffect, useState } from "react";

import { fetchInjuries } from "../api/injuries";
import { Injury } from "../types/injury";

// Lesiones activas, cargadas al montar. Si falla la petición devuelve [] en
// silencio: el aviso es un extra y nunca debe romper la pantalla donde se usa.
export function useActiveInjuries(): Injury[] {
  const [injuries, setInjuries] = useState<Injury[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchInjuries(true)
      .then((list) => {
        if (!cancelled) setInjuries(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return injuries;
}
