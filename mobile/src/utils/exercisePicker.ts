import { Exercise } from "../types/exercise";

// Orden fijo (no alfabético) en el que se muestran las secciones del picker
// de ejercicios -- coincide con el catálogo cerrado de 8 valores que expone
// el backend en `muscle_group_primary`. Duplicado literalmente desde
// `backend/app/muscle_taxonomy.py::MUSCLE_GROUPS` porque son dos codebases
// separadas -- si ese catálogo cambia en el backend, actualiza esta lista
// también (el frontend degrada bien ante un valor desconocido: cae en su
// propia sección en vez de perderse, ver groupExercisesByMuscle más abajo).
export const MUSCLE_GROUP_ORDER = [
  "Pecho",
  "Espalda",
  "Hombros",
  "Bíceps",
  "Tríceps",
  "Piernas",
  "Core",
  "Cardio / Otros",
];

export const UNCLASSIFIED_LABEL = "Sin clasificar";

export type ExerciseGroup = {
  label: string;
  exercises: Exercise[];
};

// Mapa fijo vocal-acentuada -> vocal-simple para un catálogo cerrado en
// español (á, é, í, ó, ú, ü). Se prefiere esto a `String.prototype.normalize`
// + un regex de rango Unicode de diacríticos porque no está verificado que
// esa combinación funcione igual en Hermes (el motor JS de Expo) que en un
// navegador -- con solo 6 caracteres a cubrir, un reemplazo directo es más
// simple y no depende de esa suposición.
const ACCENT_MAP: Record<string, string> = {
  á: "a",
  é: "e",
  í: "i",
  ó: "o",
  ú: "u",
  ü: "u",
};

// Normaliza un texto para comparaciones de búsqueda: minúsculas + sin
// acentos, usando ACCENT_MAP. Se aplica tanto al término buscado como a los
// campos contra los que se compara, así que "biceps" (sin tilde) encuentra
// "Bíceps" (con tilde) tal y como está guardado en el catálogo.
export function normalizeForSearch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[áéíóúü]/g, (char) => ACCENT_MAP[char] ?? char);
}

// Filtra por substring, case/acento-insensitive, contra el nombre y contra
// el músculo principal/secundarios -- así buscar "biceps" o "bíceps"
// encuentra tanto ejercicios cuyo principal es Bíceps como los que solo lo
// tienen de secundario (p.ej. "Press banca").
export function filterExercises(exercises: Exercise[], query: string): Exercise[] {
  const q = normalizeForSearch(query.trim());
  if (!q) {
    return exercises;
  }

  return exercises.filter((exercise) => {
    if (normalizeForSearch(exercise.name).includes(q)) {
      return true;
    }
    if (normalizeForSearch(exercise.muscle_group_primary ?? "").includes(q)) {
      return true;
    }
    return (exercise.muscle_group_secondary ?? []).some((m) =>
      normalizeForSearch(m).includes(q)
    );
  });
}

// Agrupa por muscle_group_primary respetando MUSCLE_GROUP_ORDER, con una
// sección final "Sin clasificar" para cualquier ejercicio sin músculo
// principal -- defensivo, no debería pasar con el backend ya desplegado,
// pero se trata igual que el resto de campos "posiblemente ausentes" de este
// proyecto (ver comentario en types/exercise.ts).
export function groupExercisesByMuscle(exercises: Exercise[]): ExerciseGroup[] {
  const byGroup = new Map<string, Exercise[]>();
  const unclassified: Exercise[] = [];

  for (const exercise of exercises) {
    const primary = exercise.muscle_group_primary;
    if (!primary) {
      unclassified.push(exercise);
      continue;
    }
    const list = byGroup.get(primary) ?? [];
    list.push(exercise);
    byGroup.set(primary, list);
  }

  const groups: ExerciseGroup[] = [];
  for (const label of MUSCLE_GROUP_ORDER) {
    const list = byGroup.get(label);
    if (list && list.length > 0) {
      groups.push({ label, exercises: list });
      byGroup.delete(label);
    }
  }

  // Cualquier valor que no esté en MUSCLE_GROUP_ORDER (no debería ocurrir con
  // el catálogo cerrado actual, pero por robustez ante un catálogo futuro más
  // amplio) se muestra igual, en su propia sección, antes de "Sin clasificar".
  for (const [label, list] of byGroup) {
    groups.push({ label, exercises: list });
  }

  if (unclassified.length > 0) {
    groups.push({ label: UNCLASSIFIED_LABEL, exercises: unclassified });
  }

  return groups;
}

// Subtítulo informativo para una fila del picker ("también: Tríceps, Core"),
// o null si el ejercicio no tiene músculos secundarios -- puramente
// decorativo, ayuda a entender por qué algo aparece en una búsqueda cruzada.
export function secondaryHint(exercise: Exercise): string | null {
  const secondary = exercise.muscle_group_secondary;
  if (!secondary || secondary.length === 0) {
    return null;
  }
  return `también: ${secondary.join(", ")}`;
}
