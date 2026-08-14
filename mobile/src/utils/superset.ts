// Agrupa una lista ya ordenada (por `order`, o por el orden natural del
// formulario) en tramos: sueltos (superset_group null) tal cual, y tramos
// contiguos que comparten el mismo superset_group como un bloque. Se asume
// que los miembros de un mismo bloque ya están contiguos en `items` -- tanto
// el backend como los formularios de este proyecto garantizan eso al
// construir la lista (las filas de un bloque se añaden/mandan juntas), así
// que no hace falta reordenar aquí, solo detectar los tramos.
export type SupersetGrouped<T> =
  | { type: "single"; item: T }
  | { type: "group"; groupId: number; items: T[] };

export function groupBySuperset<T>(
  items: T[],
  // `undefined` se acepta además de `null` porque, durante una ventana de
  // despliegue, la app nueva puede hablar con un backend viejo que todavía
  // no incluye `superset_group` en su JSON (no `null`, directamente ausente
  // del objeto) -- el tipo de este proyecto declara `number | null` para ese
  // campo, pero eso solo vale en tiempo de compilación, no protege de lo que
  // de verdad llega por la red.
  getGroup: (item: T) => number | null | undefined
): SupersetGrouped<T>[] {
  const result: SupersetGrouped<T>[] = [];

  for (const item of items) {
    const group = getGroup(item);

    // `== null` cubre tanto `null` como `undefined` a propósito -- ver
    // comentario de arriba. Con `=== null` a secas, un `undefined` caía por
    // la rama de "tiene grupo" con groupId undefined, y como
    // `last.groupId === group` da `undefined === undefined` (true), TODOS
    // los ejercicios sueltos se fundían en un único bloque falso.
    if (group == null) {
      result.push({ type: "single", item });
      continue;
    }

    const last = result[result.length - 1];
    if (last && last.type === "group" && last.groupId === group) {
      last.items.push(item);
    } else {
      result.push({ type: "group", groupId: group, items: [item] });
    }
  }

  return result;
}

// Iguala el número de rondas (filas de serie) entre los miembros de un mismo
// bloque de super-serie, rellenando con filas vacías a los más cortos hasta
// llegar al máximo del bloque. Una rutina no fuerza que target_sets sea igual
// entre miembros de un mismo grupo (p.ej. A=4 series, B=3) -- sin esto, un
// bloque podía nacer ya con rondas desiguales, y "Quitar ronda" (que opera
// sobre todos los miembros del bloque a la vez) podía acabar dejando a un
// miembro con 0 series mientras otro seguía teniendo alguna, lo que el
// backend rechaza con 400 (un superset_group necesita 2+ exercise_id
// distintos). `getGroup`/`getSets`/`withSets` son accessors genéricos porque
// TodayScreen y HistorialScreen usan formas de fila distintas (ExerciseDraft
// vs EditExerciseGroup) para lo mismo.
export function equalizeSupersetRounds<T, S>(
  rows: T[],
  getGroup: (row: T) => number | null | undefined,
  getSets: (row: T) => S[],
  withSets: (row: T, sets: S[]) => T,
  makeEmptySet: () => S
): T[] {
  const maxByGroup = new Map<number, number>();
  for (const row of rows) {
    const group = getGroup(row);
    if (group == null) {
      continue;
    }
    maxByGroup.set(group, Math.max(maxByGroup.get(group) ?? 0, getSets(row).length));
  }

  if (maxByGroup.size === 0) {
    return rows;
  }

  return rows.map((row) => {
    const group = getGroup(row);
    if (group == null) {
      return row;
    }

    const sets = getSets(row);
    const max = maxByGroup.get(group)!;
    if (sets.length >= max) {
      return row;
    }

    const padding = Array.from({ length: max - sets.length }, () => makeEmptySet());
    return withSets(row, [...sets, ...padding]);
  });
}

// Cuenta, entre las filas que realmente van a mandar alguna serie al
// backend, cuántos exercise_id DISTINTOS comparte cada superset_group -- para
// poder anular (a null) justo antes de guardar cualquier grupo que se haya
// quedado con menos de 2, como red de seguridad además de las medidas que
// evitan que esto ocurra en primer lugar (equalizeSupersetRounds, el picker
// de super-serie de entreno libre en TodayScreen).
export function validSupersetGroups(
  rows: { exerciseId: number; group: number | null | undefined; hasSets: boolean }[]
): Set<number> {
  const exerciseIdsByGroup = new Map<number, Set<number>>();

  for (const row of rows) {
    if (!row.hasSets || row.group == null) {
      continue;
    }
    const ids = exerciseIdsByGroup.get(row.group) ?? new Set<number>();
    ids.add(row.exerciseId);
    exerciseIdsByGroup.set(row.group, ids);
  }

  const valid = new Set<number>();
  for (const [group, ids] of exerciseIdsByGroup) {
    if (ids.size >= 2) {
      valid.add(group);
    }
  }
  return valid;
}
