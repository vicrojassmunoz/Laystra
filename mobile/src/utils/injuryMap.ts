import { Exercise } from "../types/exercise";
import { BodyArea, Injury, Severity } from "../types/injury";

export const BODY_AREAS: { value: BodyArea; label: string }[] = [
  { value: "hombro", label: "Hombro" },
  { value: "codo", label: "Codo" },
  { value: "muñeca", label: "Muñeca" },
  { value: "espalda_alta", label: "Espalda alta" },
  { value: "lumbar", label: "Lumbar" },
  { value: "cadera", label: "Cadera" },
  { value: "rodilla", label: "Rodilla" },
  { value: "tobillo", label: "Tobillo" },
  { value: "cuello", label: "Cuello" },
  { value: "otro", label: "Otro" },
];

export const SEVERITIES: { value: Severity; label: string }[] = [
  { value: "leve", label: "Leve" },
  { value: "moderada", label: "Moderada" },
  { value: "grave", label: "Grave" },
];

export function bodyAreaLabel(area: BodyArea): string {
  return BODY_AREAS.find((a) => a.value === area)?.label ?? area;
}

export function severityLabel(severity: Severity): string {
  return SEVERITIES.find((s) => s.value === severity)?.label ?? severity;
}

// Zona del cuerpo -> grupos musculares (los 8 del catálogo cerrado de
// utils/exercisePicker.ts: Pecho, Espalda, Hombros, Bíceps, Tríceps, Piernas,
// Core, Cardio / Otros) que *podrían* cargarla.
//
// Es una APROXIMACIÓN gruesa, solo para avisar; la app nunca dice que un
// ejercicio sea seguro ni que no lo sea. El catálogo no distingue músculos
// finos (p. ej. "Piernas" incluye cuádriceps, glúteo e isquios), así que se
// prefiere avisar de más que de menos.
// "otro" no se puede mapear: no genera avisos.
export const BODY_AREA_MUSCLES: Record<BodyArea, string[]> = {
  hombro: ["Hombros", "Pecho", "Tríceps"], // empujes y elevaciones cargan el hombro
  codo: ["Bíceps", "Tríceps"], // flexores/extensores del codo
  muñeca: ["Bíceps", "Tríceps", "Pecho"], // agarre y empujes con apoyo de muñeca
  espalda_alta: ["Espalda", "Hombros"],
  lumbar: ["Espalda", "Core", "Piernas"], // peso muerto / sentadilla cargan la zona
  cadera: ["Piernas", "Core"],
  rodilla: ["Piernas"],
  tobillo: ["Piernas", "Cardio / Otros"], // carrera, saltos
  cuello: ["Hombros", "Espalda"], // trapecios / cervicales
  otro: [],
};

// Grupos musculares del ejercicio (principal + secundarios).
function exerciseGroups(exercise: Exercise): string[] {
  return [exercise.muscle_group_primary, ...(exercise.muscle_group_secondary ?? [])].filter(
    (g): g is string => !!g
  );
}

// Lesiones ACTIVAS cuya zona se relaciona con algún músculo del ejercicio.
export function relatedInjuries(exercise: Exercise, injuries: Injury[]): Injury[] {
  const groups = exerciseGroups(exercise);
  return injuries.filter(
    (injury) =>
      injury.active && BODY_AREA_MUSCLES[injury.body_area].some((m) => groups.includes(m))
  );
}

// Zonas (en minúscula, sin repetir) de las lesiones activas relacionadas.
export function relatedAreas(exercise: Exercise, injuries: Injury[]): string[] {
  const related = relatedInjuries(exercise, injuries);
  return Array.from(new Set(related.map((i) => bodyAreaLabel(i.body_area).toLowerCase())));
}
