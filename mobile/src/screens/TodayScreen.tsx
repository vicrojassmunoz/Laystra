import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Button,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { fetchExercises } from "../api/exercises";
import { fetchRoutines } from "../api/routines";
import { createWorkout } from "../api/workouts";
import { fetchToday, TodayExercise, TodayResponse } from "../api/today";
import SupersetBlock, { SetDraft } from "../components/SupersetBlock";
import { Exercise } from "../types/exercise";
import { Routine } from "../types/routine";
import { WorkoutSetCreate } from "../types/workout";
import { equalizeSupersetRounds, groupBySuperset, validSupersetGroups } from "../utils/superset";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: TodayResponse; routines: Routine[]; exercises: Exercise[] };

// SetDraft (id + weight/reps como string) viene de SupersetBlock -- es la
// misma forma que necesita una fila de serie tanto suelta como dentro de un
// bloque, así que se reusa un único tipo en vez de declararlo dos veces.
type ExerciseDraft = {
  exercise: TodayExercise;
  sets: SetDraft[];
};

// Qué rutina (o "entreno libre") está representando el formulario ahora mismo.
// Empieza igualada a la rutina de hoy (routine_id/routine_name de /today), pero
// tras "Loguear otro entreno" puede apuntar a otra rutina distinta o a ninguna
// (entreno libre, routine_id null) -- se guarda aparte de `state.data` porque
// state.data siempre es "lo de hoy" tal cual lo devuelve el backend.
type FormTarget = {
  routineId: number | null;
  routineName: string | null; // null = entreno libre
  exercises: TodayExercise[];
};

// Resumen colapsado de un entreno ya guardado en esta sesión de pantalla, para
// no perderlo de vista mientras se rellena un segundo (o tercer) entreno.
type SavedSummary = {
  workoutId: number;
  label: string;
};

// `nextId` es un contador compartido (no uno distinto por ejercicio) que la
// pantalla pasa desde un useRef, igual que `nextRowIdRef` en RoutinesScreen.
// Da a cada fila de serie un id estable para usar como key en vez del índice
// -- así, al quitar una fila del medio, React no reutiliza por error el
// TextInput enfocado para otra serie distinta.
function buildDraft(exercises: TodayExercise[], nextId: () => number): ExerciseDraft[] {
  const drafts = exercises.map((exercise) => ({
    exercise,
    // Pre-rellena con `target_sets` filas vacías (el número de series objetivo
    // de la rutina); "+ añadir serie"/"Quitar" siguen disponibles por si un día
    // se hacen más o menos series de las planeadas.
    sets: Array.from({ length: exercise.target_sets }, () => ({
      id: nextId(),
      weight: "",
      reps: "",
    })),
  }));

  // Si esta rutina agrupa ejercicios con distinto target_sets en el mismo
  // bloque de super-serie, iguala las rondas al nacer -- ver comentario en
  // equalizeSupersetRounds.
  return equalizeSupersetRounds(
    drafts,
    (d) => d.exercise.superset_group,
    (d) => d.sets,
    (d, sets) => ({ ...d, sets }),
    () => ({ id: nextId(), weight: "", reps: "" })
  );
}

// Convierte los ejercicios de una rutina cualquiera (no necesariamente la de
// hoy) al mismo shape que usa /today, para poder reusar buildDraft. Routine
// solo trae exercise_id -- el nombre/unidad hay que resolverlos aparte con la
// lista completa de ejercicios.
function routineToExercises(routine: Routine, exerciseById: Map<number, Exercise>): TodayExercise[] {
  return routine.exercises
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((re) => {
      const exercise = exerciseById.get(re.exercise_id);
      return {
        exercise_id: re.exercise_id,
        exercise_name: exercise?.name ?? `Ejercicio #${re.exercise_id}`,
        unit: exercise?.unit ?? "kg",
        target_sets: re.target_sets,
        order: re.order,
        superset_group: re.superset_group,
      };
    });
}

// Reordena los ids elegidos para un entreno libre de forma que los miembros
// de un mismo bloque de super-serie queden contiguos -- necesario porque el
// usuario puede haber elegido los ejercicios sueltos primero y agruparlos
// después (o al revés), y tanto el render (groupBySuperset) como el backend
// asumen que un bloque es un tramo contiguo, no ids salpicados.
function buildOrderedFreeExerciseIds(
  freeSelection: number[],
  blocks: { groupId: number; exerciseIds: number[] }[]
): number[] {
  const groupOf = new Map<number, number>();
  for (const block of blocks) {
    for (const id of block.exerciseIds) {
      groupOf.set(id, block.groupId);
    }
  }

  const emitted = new Set<number>();
  const ordered: number[] = [];

  for (const id of freeSelection) {
    if (emitted.has(id)) {
      continue;
    }

    const groupId = groupOf.get(id);
    if (groupId === undefined) {
      ordered.push(id);
      emitted.add(id);
      continue;
    }

    const block = blocks.find((b) => b.groupId === groupId)!;
    for (const memberId of block.exerciseIds) {
      if (!emitted.has(memberId)) {
        ordered.push(memberId);
        emitted.add(memberId);
      }
    }
  }

  return ordered;
}

// Para un entreno libre no hay rutina que fije target_sets, así que se parte
// de 1 serie por ejercicio elegido -- "+ añadir serie" cubre el resto.
// `groupByExerciseId` viene de los bloques de super-serie armados en el
// picker de "entreno libre" (ver confirmFreeSuperset) -- ninguno si no se
// usó "+ Super-serie".
function freeExercisesToDraftExercises(
  selected: Exercise[],
  groupByExerciseId: Map<number, number>
): TodayExercise[] {
  return selected.map((exercise, index) => ({
    exercise_id: exercise.id,
    exercise_name: exercise.name,
    unit: exercise.unit,
    target_sets: 1,
    order: index,
    superset_group: groupByExerciseId.get(exercise.id) ?? null,
  }));
}

// Título que se muestra arriba del formulario: mientras no se ha elegido nada
// (formTarget null, primer entreno del día) refleja la rutina de /today; en
// cuanto el usuario elige otra rutina o "entreno libre" con "Loguear otro
// entreno", tiene que reflejar ESO en vez de seguir mostrando la rutina de hoy.
function headerRoutineName(formTarget: FormTarget | null, data: TodayResponse): string {
  if (formTarget) {
    return formTarget.routineId === null ? "Entreno libre" : formTarget.routineName ?? "Rutina";
  }
  return data.routine_name ?? "Día de descanso";
}

export default function TodayScreen() {
  const tabBarHeight = useBottomTabBarHeight();
  const [state, setState] = useState<State>({ status: "loading" });
  // Recuerda si ya tenemos datos en pantalla para no tapar la vista con un
  // spinner cada vez que el usuario vuelve a esta pestaña.
  const hasDataRef = useRef(false);

  const [formTarget, setFormTarget] = useState<FormTarget | null>(null);
  const [formRows, setFormRows] = useState<ExerciseDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // El usuario descartó el entreno pre-rellenado de hoy (rutina asignada, o el
  // que dejó abierto "Loguear otro entreno") sin llegar a guardarlo -- no
  // quiere loguear nada ahora mismo, ni ese ni ningún otro por el momento.
  // Distinto de "Cancelar" (que solo aplica si ya hay algo guardado hoy al
  // que volver): esto es para el caso en que todavía no se ha guardado nada.
  const [skipped, setSkipped] = useState(false);
  // Entrenos ya guardados hoy en esta pantalla (el de /today más los que se
  // vayan añadiendo con "Loguear otro entreno"), para mostrarlos de forma
  // resumida mientras se rellena el siguiente. Se reinicia cuando cambia el
  // día (ver el useEffect de más abajo).
  const [savedSummaries, setSavedSummaries] = useState<SavedSummary[]>([]);

  // Picker de dos pasos para "Loguear otro entreno": "target" (elegir otra
  // rutina o "entreno libre") y "exercises" (solo para entreno libre, elegir
  // qué ejercicios sueltos). Es un único estado de "paso" en vez de dos
  // booleanos de dos <Modal> hermanos -- montar un segundo Modal en el mismo
  // tick en que se cierra el primero (setTargetPickerVisible(false) +
  // setExercisePickerVisible(true) juntos) es un patrón conocido por dar
  // glitches en iOS/RN (el segundo modal no aparece, o queda el backdrop del
  // primero). Con un solo <Modal visible={pickerStep !== null}> solo hay uno
  // montado/desmontado a la vez; lo que cambia es el contenido de dentro.
  // "free-superset" es un tercer paso anidado dentro de "exercises": desde
  // ahí se elige qué ejercicios (de los que existen, no necesariamente ya
  // marcados) forman un bloque de super-serie para el entreno libre. Al
  // confirmar, vuelve a "exercises" (no cierra todo el picker).
  const [pickerStep, setPickerStep] = useState<"target" | "exercises" | "free-superset" | null>(
    null
  );
  const [freeSelection, setFreeSelection] = useState<number[]>([]);
  // Bloques de super-serie armados para el entreno libre en curso -- viven
  // aparte de freeSelection porque un ejercicio puede estar "seleccionado"
  // sin pertenecer a ningún bloque (ejercicio suelto). Local a este picker,
  // se resetea cada vez que se vuelve a abrir "Entreno libre".
  const [freeSupersetBlocks, setFreeSupersetBlocks] = useState<
    { groupId: number; exerciseIds: number[] }[]
  >([]);
  const [freeSupersetSelection, setFreeSupersetSelection] = useState<number[]>([]);
  const nextFreeGroupIdRef = useRef(1);

  // Instantánea de formTarget/formRows justo tras el último guardado exitoso,
  // para poder volver a ella si el usuario pulsa "Loguear otro entreno", elige
  // un destino, y luego se arrepiente -- sin esto no había forma de salir de
  // ese formulario en blanco salvo guardarlo o cambiar de pestaña.
  const lastSubmittedSnapshotRef = useRef<{
    formTarget: FormTarget;
    formRows: ExerciseDraft[];
  } | null>(null);

  // Identifica qué se está logueando (fecha + rutina + firma de ejercicios/sets/reps
  // objetivo). Mientras esta clave no cambie, el formulario no se reconstruye en
  // cada focus -- si no, volver de "Historial" a "Hoy" borraría lo ya escrito (o,
  // peor, invitaría a re-guardar un entreno ya guardado como si fuera nuevo).
  const draftKeyRef = useRef<string | null>(null);
  // Contador compartido para los ids de fila de serie (ver comentario en
  // buildDraft). Empieza en 1 y nunca se resetea entre reconstrucciones del
  // draft -- no hace falta, solo importa que cada id sea único dentro de la
  // vida de la pantalla.
  const nextSetIdRef = useRef(1);
  function nextSetId(): number {
    return nextSetIdRef.current++;
  }

  const load = useCallback(() => {
    if (!hasDataRef.current) {
      setState({ status: "loading" });
    }

    // Se piden rutinas y ejercicios junto con /today -- no solo para el
    // formulario de hoy, sino porque "Loguear otro entreno" necesita elegir
    // entre todas las rutinas (no solo la de hoy) o ejercicios sueltos.
    Promise.all([fetchToday(), fetchRoutines(), fetchExercises()])
      .then(([data, routines, exercises]) => {
        hasDataRef.current = true;
        setState({ status: "ready", data, routines, exercises });
      })
      .catch((error: Error) => {
        // Si ya había datos visibles, los dejamos y simplemente no se refrescan
        // esta vez, en vez de reemplazar una pantalla buena por un error.
        if (!hasDataRef.current) {
          setState({ status: "error", message: error.message });
        }
      });
  }, []);

  // useFocusEffect (de @react-navigation/native) corre cada vez que esta pantalla
  // gana el foco dentro del Tab.Navigator, no solo al montarse. Un Tab.Navigator
  // mantiene las pantallas montadas al cambiar de pestaña, así que un useEffect
  // normal solo se ejecutaría una vez y nunca vería datos creados en otra pestaña.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // /today se vuelve a pedir en cada focus (ver useFocusEffect de arriba), pero eso
  // NO debe implicar reconstruir el formulario en cada focus: si lo hiciera, entrar
  // a "Historial" a comprobar algo y volver a "Hoy" borraría lo que el usuario ya
  // había escrito (o, tras guardar, el formulario "olvidaría" que ya se guardó y
  // dejaría loguear el mismo día dos veces -- el backend no bloquea duplicados).
  // En vez de eso, el draft solo se reconstruye cuando cambia lo que realmente se
  // está logueando: la fecha, la rutina asignada, o la propia rutina (ejercicios
  // o series objetivo editados desde la pestaña "Rutinas"/"Semana").
  useEffect(() => {
    if (state.status !== "ready") {
      return;
    }

    const key = [
      state.data.date,
      state.data.routine_id,
      // superset_group entra en la firma para que agrupar/desagrupar
      // ejercicios ya existentes desde "Rutinas" (sin tocar ejercicios ni
      // sets) también invalide el draft cacheado -- si no, volver a "Hoy"
      // seguía mostrando la agrupación vieja, y guardar así persistía el
      // entreno con esa agrupación desactualizada en silencio.
      ...state.data.exercises.map(
        (e) => `${e.exercise_id}:${e.target_sets}:${e.superset_group}`
      ),
    ].join("|");

    if (draftKeyRef.current === key) {
      // Mismo día, misma rutina: conserva lo que haya en pantalla, tanto si
      // el usuario sigue rellenando como si ya se guardó (submitted=true) --
      // si no, volver de otra pestaña "olvidaría" que ya se guardó hoy.
      return;
    }

    // Cambió el día (o la rutina de hoy): es un día nuevo, así que también se
    // olvidan los resúmenes de entrenos guardados anteriormente.
    draftKeyRef.current = key;
    setFormTarget({
      routineId: state.data.routine_id,
      routineName: state.data.routine_name,
      exercises: state.data.exercises,
    });
    setFormRows(buildDraft(state.data.exercises, nextSetId));
    setFormError(null);
    setSubmitted(false);
    setSkipped(false);
    setSavedSummaries([]);
  }, [state]);

  function updateSet(exerciseIndex: number, setIndex: number, patch: Partial<SetDraft>) {
    setFormRows((prev) =>
      prev.map((row, i) => {
        if (i !== exerciseIndex) {
          return row;
        }

        const updatedSets = row.sets.map((s, j) => (j === setIndex ? { ...s, ...patch } : s));

        // Autorrelleno: al escribir el peso de una serie, se propaga a las demás
        // series del mismo ejercicio que sigan vacías (mismo ejercicio suele
        // pesar lo mismo en todas sus series). El usuario solo corrige a mano
        // las que difieran; si ya escribió algo distinto en una, esa deja de
        // tocarse porque ya no está vacía.
        if (patch.weight !== undefined && patch.weight.trim() !== "") {
          for (let j = 0; j < updatedSets.length; j++) {
            if (j !== setIndex && row.sets[j].weight.trim() === "") {
              updatedSets[j] = { ...updatedSets[j], weight: patch.weight };
            }
          }
        }

        return { ...row, sets: updatedSets };
      })
    );
  }

  function addSet(exerciseIndex: number) {
    setFormRows((prev) =>
      prev.map((row, i) => {
        if (i !== exerciseIndex) {
          return row;
        }

        // La fila nueva hereda el peso de la última serie existente (si la
        // hay y no está vacía) -- el mismo ejercicio suele pesar lo mismo en
        // todas sus series, así que ahorra tener que volver a escribirlo.
        const lastWeight = row.sets.length > 0 ? row.sets[row.sets.length - 1].weight : "";

        return {
          ...row,
          sets: [...row.sets, { id: nextSetId(), weight: lastWeight, reps: "" }],
        };
      })
    );
  }

  function removeSet(exerciseIndex: number, setIndex: number) {
    setFormRows((prev) =>
      prev.map((row, i) =>
        i === exerciseIndex ? { ...row, sets: row.sets.filter((_, j) => j !== setIndex) } : row
      )
    );
  }

  // Variantes de addSet/removeSet para un bloque de super-serie: en vez de
  // tocar un solo ejercicio, añaden/quitan la misma "ronda" (posición de
  // serie) en TODOS los ejercicios del bloque a la vez -- exerciseIndices son
  // las posiciones dentro de formRows de los miembros de ese bloque.
  function addRoundToGroup(exerciseIndices: number[]) {
    for (const index of exerciseIndices) {
      addSet(index);
    }
  }

  function removeRoundFromGroup(exerciseIndices: number[], roundIndex: number) {
    setFormRows((prev) =>
      prev.map((row, i) =>
        exerciseIndices.includes(i)
          ? { ...row, sets: row.sets.filter((_, j) => j !== roundIndex) }
          : row
      )
    );
  }

  // "Loguear otro entreno" ya no reutiliza directamente la rutina de hoy --
  // abre el picker para elegir otra rutina o un entreno libre. El formulario
  // solo se reconstruye cuando el usuario termina de elegir (ver
  // chooseRoutineForAnother / confirmFreeSelection).
  function handleLogAnother() {
    setPickerStep("target");
  }

  function chooseRoutineForAnother(routine: Routine) {
    if (state.status !== "ready") {
      return;
    }

    const exerciseById = new Map(state.exercises.map((e) => [e.id, e]));
    const exercises = routineToExercises(routine, exerciseById);

    setFormTarget({ routineId: routine.id, routineName: routine.name, exercises });
    setFormRows(buildDraft(exercises, nextSetId));
    setFormError(null);
    setSubmitted(false);
    setSkipped(false);
    setPickerStep(null);
  }

  function chooseFreeForAnother() {
    setFreeSelection([]);
    setFreeSupersetBlocks([]);
    setPickerStep("exercises");
  }

  // Si el ejercicio que se desmarca pertenecía a un bloque, se le quita del
  // bloque; si eso deja el bloque con menos de 2 miembros, se disuelve del
  // todo (el miembro que quede, si queda uno, pasa a suelto sin más pasos --
  // no hace falta "desagruparlo" a mano porque ya no hay bloque que lo
  // referencie). Al marcar un ejercicio (no desmarcarlo) esto no tiene efecto,
  // ya que un ejercicio recién marcado nunca pertenece todavía a ningún bloque.
  function toggleFreeExercise(id: number) {
    setFreeSelection((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    setFreeSupersetBlocks((prev) =>
      prev
        .map((block) =>
          block.exerciseIds.includes(id)
            ? { ...block, exerciseIds: block.exerciseIds.filter((x) => x !== id) }
            : block
        )
        .filter((block) => block.exerciseIds.length >= 2)
    );
  }

  function openFreeSupersetPicker() {
    setFreeSupersetSelection([]);
    setPickerStep("free-superset");
  }

  // Ids que ya pertenecen a un bloque de super-serie armado anteriormente en
  // este entreno libre -- no pueden volver a elegirse para un bloque nuevo.
  // Sin esto, elegir un ejercicio ya agrupado para un segundo bloque
  // sobrescribía a qué grupo pertenecía (el Map de abajo se construye por
  // ejercicio, no por bloque) y dejaba el bloque viejo con un solo miembro,
  // que el backend rechaza con 400 al guardar.
  function alreadyGroupedFreeExerciseIds(): Set<number> {
    const ids = new Set<number>();
    for (const block of freeSupersetBlocks) {
      for (const id of block.exerciseIds) {
        ids.add(id);
      }
    }
    return ids;
  }

  function toggleFreeSupersetExercise(id: number) {
    if (alreadyGroupedFreeExerciseIds().has(id)) {
      return;
    }
    setFreeSupersetSelection((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // Confirma un bloque de super-serie para el entreno libre: los ejercicios
  // elegidos aquí se añaden también a freeSelection si no lo estaban ya --
  // agruparlos implica que forman parte del entreno, igual que en Rutinas.
  function confirmFreeSuperset() {
    if (freeSupersetSelection.length < 2) {
      return;
    }

    const groupId = nextFreeGroupIdRef.current++;
    setFreeSupersetBlocks((prev) => [...prev, { groupId, exerciseIds: freeSupersetSelection }]);
    setFreeSelection((prev) => {
      const merged = new Set(prev);
      for (const id of freeSupersetSelection) {
        merged.add(id);
      }
      return Array.from(merged);
    });
    setPickerStep("exercises");
  }

  function confirmFreeSelection() {
    if (state.status !== "ready" || freeSelection.length === 0) {
      return;
    }

    const exerciseById = new Map(state.exercises.map((e) => [e.id, e]));
    const orderedIds = buildOrderedFreeExerciseIds(freeSelection, freeSupersetBlocks);
    const selected = orderedIds
      .map((id) => exerciseById.get(id))
      .filter((e): e is Exercise => e !== undefined);

    const groupByExerciseId = new Map<number, number>();
    for (const block of freeSupersetBlocks) {
      for (const id of block.exerciseIds) {
        groupByExerciseId.set(id, block.groupId);
      }
    }

    const exercises = freeExercisesToDraftExercises(selected, groupByExerciseId);

    setFormTarget({ routineId: null, routineName: null, exercises });
    setFormRows(buildDraft(exercises, nextSetId));
    setFormError(null);
    setSubmitted(false);
    setSkipped(false);
    setPickerStep(null);
  }

  // Descarta el entreno pre-rellenado de hoy (o el que se estuviera montando
  // tras "Loguear otro entreno") sin haberlo guardado -- para cuando el
  // usuario no quiere loguear nada ahora mismo, ni siquiera lo que ya había en
  // pantalla. Deja la puerta abierta a elegir algo después con el mismo picker
  // que usa "Loguear otro entreno" (reutiliza handleLogAnother).
  function handleSkipToday() {
    setSkipped(true);
    setFormError(null);
  }

  // Abandona el formulario en blanco abierto tras "Loguear otro entreno" y
  // vuelve a mostrar el último entreno guardado como si no se hubiera pulsado
  // ese botón. Solo tiene sentido si ya hay una instantánea previa (siempre la
  // hay en cuanto savedSummaries no está vacío, ver dónde se guarda el ref).
  function handleCancelAnother() {
    const snapshot = lastSubmittedSnapshotRef.current;
    if (!snapshot) {
      return;
    }

    setFormTarget(snapshot.formTarget);
    setFormRows(snapshot.formRows);
    setFormError(null);
    setSubmitted(true);
  }

  function handleSave() {
    if (state.status !== "ready" || !formTarget) {
      return;
    }

    setFormError(null);

    // Red de seguridad: pese a equalizeSupersetRounds (en buildDraft) y al
    // picker de super-serie de entreno libre bloqueando solapes, cualquier
    // superset_group que en este momento cubra menos de 2 exercise_id
    // distintos (entre las filas que de verdad van a mandar series) se anula
    // a null aquí en vez de dejar que el backend lo rechace con un 400 que el
    // usuario no sabría interpretar.
    const validGroups = validSupersetGroups(
      formRows.map((row) => ({
        exerciseId: row.exercise.exercise_id,
        group: row.exercise.superset_group,
        hasSets: row.sets.length > 0,
      }))
    );

    const sets: WorkoutSetCreate[] = [];
    let order = 0;

    for (const row of formRows) {
      // Un ejercicio se puede saltar del todo (máquina ocupada, etc.) quitando
      // todas sus series -- si no quedó ninguna, no hay nada que validar ni
      // que mandar por este ejercicio.
      if (row.sets.length === 0) {
        continue;
      }

      for (let i = 0; i < row.sets.length; i++) {
        const draft = row.sets[i];
        // El teclado decimal-pad en un iPhone con locale español muestra coma,
        // no punto, así que "82,5" tiene que normalizarse antes de Number(...).
        const weightRaw = draft.weight.trim().replace(",", ".");
        const weight = Number(weightRaw);
        const reps = Number(draft.reps);

        if (weightRaw === "" || Number.isNaN(weight) || weight < 0) {
          setFormError(
            `Peso inválido en "${row.exercise.exercise_name}", serie ${i + 1}.`
          );
          return;
        }

        if (draft.reps.trim() === "" || !Number.isInteger(reps) || reps < 0) {
          setFormError(
            `Reps inválidas en "${row.exercise.exercise_name}", serie ${i + 1}.`
          );
          return;
        }

        const group = row.exercise.superset_group;

        sets.push({
          exercise_id: row.exercise.exercise_id,
          weight,
          reps,
          order: order++,
          superset_group: group != null && validGroups.has(group) ? group : null,
        });
      }
    }

    if (sets.length === 0) {
      setFormError("Añade al menos una serie antes de guardar.");
      return;
    }

    setSaving(true);
    // Se usa la fecha que ya devolvió /today (no se recalcula "hoy" en el momento
    // de guardar) para que fecha y rutina no puedan desincronizarse si la app
    // queda abierta justo a caballo de medianoche. El routine_id, en cambio, sale
    // de formTarget -- puede ser distinto al de /today si esto es un "otro entreno".
    createWorkout({ date: state.data.date, routine_id: formTarget.routineId, sets })
      .then((workout) => {
        const distinctExercises = new Set(sets.map((s) => s.exercise_id)).size;
        const label = `${formTarget.routineName ?? "Entreno libre"} — ${distinctExercises} ejercicio${
          distinctExercises === 1 ? "" : "s"
        }`;
        setSavedSummaries((prev) => [...prev, { workoutId: workout.id, label }]);
        setSubmitted(true);
        lastSubmittedSnapshotRef.current = { formTarget, formRows };
      })
      .catch((error: Error) => {
        setFormError(error.message);
      })
      .finally(() => {
        setSaving(false);
      });
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {state.status === "loading" && <ActivityIndicator size="large" />}

      {state.status === "error" && (
        <View>
          <Text style={styles.title}>No se pudo conectar con el backend</Text>
          <Text style={styles.errorDetail}>{state.message}</Text>
        </View>
      )}

      {state.status === "ready" && (
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={tabBarHeight}
        >
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Hoy</Text>
            <Text style={styles.subtitle}>{headerRoutineName(formTarget, state.data)}</Text>

            {state.data.exercises.length === 0 && (
              <Text style={styles.restDayText}>
                No hay rutina asignada para hoy. Aprovecha para descansar.
              </Text>
            )}

            {/* Resumen de entrenos ya guardados hoy. Se muestra siempre que haya
                alguno -- también tras guardar el último, no solo mientras se
                rellena el siguiente -- si no, guardar un segundo entreno hacía
                desaparecer de la pantalla la constancia del primero. */}
            {savedSummaries.length > 0 && (
              <View style={styles.savedSummaries}>
                {savedSummaries.map((s) => (
                  <Text key={s.workoutId} style={styles.savedSummaryText}>
                    ✓ {s.label}
                  </Text>
                ))}
              </View>
            )}

            {/* El usuario descartó explícitamente el entreno pre-rellenado (o el
                que estaba montando) sin guardarlo -- en vez del formulario, solo
                un aviso y la puerta abierta a elegir algo con el mismo picker de
                "Loguear otro entreno". */}
            {skipped && (
              <View style={styles.skippedBox}>
                <Text style={styles.skippedText}>
                  No vas a loguear ningún entreno ahora mismo.
                </Text>
                <View style={styles.logAnotherButton}>
                  <Button title="Elegir un entreno" onPress={handleLogAnother} />
                </View>
              </View>
            )}

            {!skipped &&
              groupBySuperset(
                formRows.map((row, index) => ({ row, index })),
                (entry) => entry.row.exercise.superset_group
              ).map((entry) => {
                if (entry.type === "single") {
                  const { row, index: exerciseIndex } = entry.item;
                  return (
                    // Una rutina puede repetir el mismo ejercicio (p.ej. press
                    // banca pesado + press banca ligero), así que exercise_id
                    // solo no es una key única -- se combina con la posición.
                    <View key={`${row.exercise.exercise_id}-${exerciseIndex}`} style={styles.card}>
                      <Text style={styles.exerciseName}>{row.exercise.exercise_name}</Text>
                      {/* En entreno libre no hay rutina que fije target_sets --
                          se le pone 1 de relleno (ver freeExercisesToDraftExercises)
                          pero no significa nada real, así que no tiene sentido
                          mostrarlo. */}
                      {formTarget?.routineId !== null && (
                        <Text style={styles.targetText}>
                          Objetivo: {row.exercise.target_sets} serie
                          {row.exercise.target_sets === 1 ? "" : "s"}
                        </Text>
                      )}

                      {row.sets.map((setDraft, setIndex) => (
                        <View key={setDraft.id} style={styles.setRow}>
                          <Text style={styles.setLabel}>Serie {setIndex + 1}</Text>
                          <TextInput
                            style={styles.weightInput}
                            placeholder={row.exercise.unit}
                            keyboardType="decimal-pad"
                            value={setDraft.weight}
                            editable={!submitted && !saving}
                            onChangeText={(text) =>
                              updateSet(exerciseIndex, setIndex, { weight: text })
                            }
                          />
                          <TextInput
                            style={styles.repsInput}
                            placeholder="reps"
                            keyboardType="number-pad"
                            value={setDraft.reps}
                            editable={!submitted && !saving}
                            onChangeText={(text) => updateSet(exerciseIndex, setIndex, { reps: text })}
                          />
                          {!submitted && (
                            <Button
                              title="Quitar"
                              color="#b00020"
                              onPress={() => removeSet(exerciseIndex, setIndex)}
                              disabled={saving}
                            />
                          )}
                        </View>
                      ))}

                      {!submitted && (
                        <View style={styles.addSetButton}>
                          <Button
                            title="+ añadir serie"
                            onPress={() => addSet(exerciseIndex)}
                            disabled={saving}
                          />
                        </View>
                      )}
                    </View>
                  );
                }

                const indices = entry.items.map((it) => it.index);
                const members = entry.items.map((it) => ({
                  key: `${it.row.exercise.exercise_id}-${it.index}`,
                  name: it.row.exercise.exercise_name,
                  unit: it.row.exercise.unit,
                  sets: it.row.sets,
                }));

                return (
                  <SupersetBlock
                    key={`group-${entry.groupId}`}
                    members={members}
                    disabled={submitted || saving}
                    onChangeSet={(memberIndex, roundIndex, patch) =>
                      updateSet(indices[memberIndex], roundIndex, patch)
                    }
                    onAddRound={() => addRoundToGroup(indices)}
                    onRemoveRound={(roundIndex) => removeRoundFromGroup(indices, roundIndex)}
                  />
                );
              })}

            {formError && <Text style={styles.errorDetail}>{formError}</Text>}

            {!skipped && formRows.length > 0 && (
              <View style={styles.saveButton}>
                {submitted ? (
                  // El resumen de arriba (savedSummaries) ya deja constancia de que
                  // este entreno se guardó, como último ítem de la lista -- no hace
                  // falta repetirlo aquí también.
                  <View style={styles.logAnotherButton}>
                    <Button title="Loguear otro entreno" onPress={handleLogAnother} />
                  </View>
                ) : (
                  <>
                    <Button
                      title={saving ? "Guardando..." : "Guardar entreno"}
                      onPress={handleSave}
                      disabled={saving}
                    />
                    {/* "Cancelar" (volver a lo último guardado) solo tiene
                        sentido si ya hay algo guardado hoy a lo que volver;
                        si es el primer entreno del día, en su lugar se ofrece
                        "Quitar" para descartarlo sin más. Mutuamente
                        excluyentes, nunca se muestran los dos a la vez. */}
                    {savedSummaries.length > 0 ? (
                      <View style={styles.cancelAnotherButton}>
                        <Button
                          title="Cancelar"
                          color="#b00020"
                          onPress={handleCancelAnother}
                          disabled={saving}
                        />
                      </View>
                    ) : (
                      <View style={styles.cancelAnotherButton}>
                        <Button
                          title="Quitar entreno de hoy"
                          color="#b00020"
                          onPress={handleSkipToday}
                          disabled={saving}
                        />
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </ScrollView>

          {/* Un único Modal para los dos pasos de "Loguear otro entreno" -- ver
              comentario en la declaración de pickerStep sobre por qué no son
              dos <Modal> hermanos alternando visibilidad. El fondo es un
              Pressable que cierra el picker al tocar fuera de la tarjeta --
              salida rápida sin depender de llegar hasta el botón "Cancelar"
              (que puede quedar más abajo si la lista de rutinas/ejercicios es
              larga). La tarjeta en sí es otro Pressable con onPress vacío: en
              RN, el toque lo capta el Pressable más interno bajo el dedo, así
              que tocar dentro de la tarjeta nunca llega a "burbujear" hasta el
              del fondo. */}
          <Modal
            visible={pickerStep !== null}
            transparent
            animationType="slide"
            onRequestClose={() => setPickerStep(null)}
          >
            <Pressable style={styles.modalBackdrop} onPress={() => setPickerStep(null)}>
              <Pressable style={styles.modalCard} onPress={() => {}}>
                {pickerStep === "target" && (
                  <>
                    <Text style={styles.modalTitle}>¿Qué quieres loguear?</Text>

                    <ScrollView>
                      <TouchableOpacity style={styles.freeOption} onPress={chooseFreeForAnother}>
                        <Text style={styles.freeOptionText}>Entreno libre (ejercicios sueltos)</Text>
                      </TouchableOpacity>

                      {state.routines.map((routine) => (
                        <TouchableOpacity
                          key={routine.id}
                          style={styles.option}
                          onPress={() => chooseRoutineForAnother(routine)}
                        >
                          <Text style={styles.optionText}>{routine.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>

                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => setPickerStep(null)}
                    >
                      <Text style={styles.cancelText}>Cancelar</Text>
                    </TouchableOpacity>
                  </>
                )}

                {pickerStep === "exercises" && (
                  <>
                    <Text style={styles.modalTitle}>Elige ejercicios</Text>

                    <ScrollView>
                      {state.exercises.map((exercise) => {
                        const selected = freeSelection.includes(exercise.id);
                        // Solo indicativo (no afecta la selección): si este
                        // ejercicio ya forma parte de un bloque de
                        // super-serie armado con "+ Super-serie" más abajo.
                        const inBlock = freeSupersetBlocks.some((b) =>
                          b.exerciseIds.includes(exercise.id)
                        );
                        return (
                          <TouchableOpacity
                            key={exercise.id}
                            style={styles.option}
                            onPress={() => toggleFreeExercise(exercise.id)}
                          >
                            <Text style={selected ? styles.optionTextSelected : styles.optionText}>
                              {selected ? "✓ " : ""}
                              {exercise.name}
                              {inBlock ? " · Super-serie" : ""}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    <TouchableOpacity style={styles.supersetOption} onPress={openFreeSupersetPicker}>
                      <Text style={styles.supersetOptionText}>+ Super-serie</Text>
                    </TouchableOpacity>

                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => setPickerStep(null)}
                      >
                        <Text style={styles.cancelText}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.doneButton}
                        onPress={confirmFreeSelection}
                        disabled={freeSelection.length === 0}
                      >
                        <Text
                          style={
                            freeSelection.length === 0 ? styles.doneTextDisabled : styles.doneText
                          }
                        >
                          Listo ({freeSelection.length})
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {/* Paso anidado dentro de "exercises": elige qué ejercicios
                    (de todos los existentes, no solo los ya marcados) forman
                    un bloque de super-serie para este entreno libre. Al
                    confirmar vuelve a "exercises", no cierra el picker. */}
                {pickerStep === "free-superset" && (
                  <>
                    <Text style={styles.modalTitle}>Elige ejercicios para la super-serie</Text>

                    <ScrollView>
                      {state.exercises.map((exercise) => {
                        const selected = freeSupersetSelection.includes(exercise.id);
                        // Un ejercicio que ya pertenece a un bloque anterior
                        // no puede elegirse para uno nuevo -- ver comentario
                        // en alreadyGroupedFreeExerciseIds.
                        const alreadyGrouped =
                          !selected && alreadyGroupedFreeExerciseIds().has(exercise.id);
                        return (
                          <TouchableOpacity
                            key={exercise.id}
                            style={styles.option}
                            onPress={() => toggleFreeSupersetExercise(exercise.id)}
                            disabled={alreadyGrouped}
                          >
                            <Text
                              style={
                                alreadyGrouped
                                  ? styles.optionTextDisabled
                                  : selected
                                  ? styles.optionTextSelected
                                  : styles.optionText
                              }
                            >
                              {selected ? "✓ " : ""}
                              {exercise.name}
                              {alreadyGrouped ? " · ya en otro bloque" : ""}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>

                    <View style={styles.modalActions}>
                      <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={() => setPickerStep("exercises")}
                      >
                        <Text style={styles.cancelText}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.doneButton}
                        onPress={confirmFreeSuperset}
                        disabled={freeSupersetSelection.length < 2}
                      >
                        <Text
                          style={
                            freeSupersetSelection.length < 2
                              ? styles.doneTextDisabled
                              : styles.doneText
                          }
                        >
                          Listo ({freeSupersetSelection.length})
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </Pressable>
            </Pressable>
          </Modal>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  content: {
    padding: 16,
    paddingBottom: 48,
    alignItems: "stretch",
  },
  title: {
    fontSize: 24,
    fontWeight: "600",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 18,
    color: "#555",
    marginBottom: 16,
    textAlign: "center",
  },
  restDayText: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
    marginTop: 8,
  },
  skippedBox: {
    alignItems: "center",
    marginTop: 8,
  },
  skippedText: {
    fontSize: 16,
    color: "#555",
    textAlign: "center",
  },
  savedSummaries: {
    marginBottom: 12,
  },
  savedSummaryText: {
    fontSize: 14,
    color: "#1b8a1b",
    marginBottom: 2,
  },
  card: {
    backgroundColor: "#f4f4f4",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 2,
  },
  targetText: {
    fontSize: 13,
    color: "#777",
    marginBottom: 8,
  },
  addSetButton: {
    marginTop: 4,
  },
  setRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  setLabel: {
    fontSize: 14,
    color: "#555",
    width: 64,
  },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
  },
  repsInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
  },
  saveButton: {
    marginTop: 12,
    alignItems: "center",
  },
  logAnotherButton: {
    marginTop: 12,
  },
  cancelAnotherButton: {
    marginTop: 8,
  },
  errorDetail: {
    fontSize: 14,
    color: "#b00020",
    marginTop: 8,
    textAlign: "center",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: "70%",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    marginBottom: 16,
    textAlign: "center",
  },
  option: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  optionText: {
    fontSize: 16,
    textAlign: "center",
  },
  optionTextSelected: {
    fontSize: 16,
    textAlign: "center",
    fontWeight: "600",
    color: "#1b8a1b",
  },
  // Ejercicio ya perteneciente a otro bloque de super-serie -- no
  // seleccionable para uno nuevo, ver alreadyGroupedFreeExerciseIds.
  optionTextDisabled: {
    fontSize: 16,
    textAlign: "center",
    color: "#aaa",
  },
  // "Entreno libre" es una opción especial (no una rutina), separada del resto
  // con más peso visual y un borde algo más marcado para que no se confunda
  // con una rutina más de la lista.
  freeOption: {
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: "#ccc",
    marginBottom: 4,
  },
  freeOptionText: {
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  // Abre el paso anidado "free-superset" -- separado visualmente del listado
  // de ejercicios con un borde superior, ya que no es un ejercicio más de la
  // lista sino una acción distinta.
  supersetOption: {
    paddingVertical: 12,
    borderTopWidth: 2,
    borderTopColor: "#ccc",
    marginTop: 4,
  },
  supersetOptionText: {
    fontSize: 15,
    fontWeight: "600",
    textAlign: "center",
    color: "#3b5bdb",
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
  },
  cancelText: {
    fontSize: 16,
    textAlign: "center",
    color: "#b00020",
    fontWeight: "600",
  },
  doneButton: {
    flex: 1,
    paddingVertical: 14,
  },
  doneText: {
    fontSize: 16,
    textAlign: "center",
    color: "#1b8a1b",
    fontWeight: "600",
  },
  doneTextDisabled: {
    fontSize: 16,
    textAlign: "center",
    color: "#aaa",
    fontWeight: "600",
  },
});
