// Tips estáticos de la barra de sesión. Sin red ni IA: una frase por grupo
// muscular principal (los 8 de MUSCLE_GROUP_ORDER) más unas generales como
// fallback para ejercicios sin clasificar o de un grupo futuro.
const TIPS_BY_GROUP: Record<string, string[]> = {
  Pecho: [
    "Escápulas juntas y abajo antes de empujar.",
    "Baja controlado: 2 segundos en la fase excéntrica.",
  ],
  Espalda: [
    "Piensa en llevar los codos hacia atrás, no las manos.",
    "Pausa 1 segundo con la espalda contraída arriba.",
  ],
  Hombros: [
    "Menos peso y más control: el hombro castiga la técnica pobre.",
    "No subas los trapecios hacia las orejas.",
  ],
  "Bíceps": ["Codos pegados al cuerpo; si balanceas, baja el peso."],
  "Tríceps": ["Codos fijos y rango completo, hasta extender del todo."],
  Piernas: [
    "Rodillas en línea con los pies; empuja el suelo.",
    "Respira y bloquea el core antes de bajar.",
  ],
  Core: ["Exhala al esforzarte y mantén las costillas abajo."],
  "Cardio / Otros": ["Mantén un ritmo que te deje hablar entrecortado."],
};

const GENERAL_TIPS = [
  "Descansa 2–3 min en básicos pesados, 60–90 s en accesorios.",
  "Si la técnica se rompe, termina la serie ahí.",
  "Apunta cómo te sentiste: lo agradecerás luego en Historial.",
  "Hidrátate entre series 💧",
];

// Determinista (misma clave → mismo tip) para que no cambie en cada re-render.
export function tipFor(muscleGroup: string | null | undefined, seed: number): string {
  const pool = (muscleGroup && TIPS_BY_GROUP[muscleGroup]) || GENERAL_TIPS;
  return pool[Math.abs(seed) % pool.length];
}
