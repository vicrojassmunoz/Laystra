# Arquitectura mobile — Laystra

App Expo (React Native) + TypeScript, SDK 58. Consume la API REST del backend FastAPI.

## Navegación

```
Stack.Navigator (root, initialRouteName: Home)
├── Home          (hub; header oculto)
├── Hoy           (resumen del día + empezar/volver a la sesión)
├── Sesion        (formulario de logueo + cronómetro; se abre desde Hoy)
├── Rutinas
├── Semana
├── Historial
├── Progreso
├── Objetivos
├── Perfil (User)
├── Agua
└── Análisis
```

`SessionPill` (flotante, fuera del navigator pero dentro del `NavigationContainer`) aparece en cualquier pantalla menos `Sesion` mientras hay sesión en curso; toque → `Sesion`. `App.tsx` envuelve todo en `SessionProvider` y usa `createNavigationContainerRef` + `onStateChange` para saber la ruta visible.

Sin bottom tab bar (ROADMAP #10 del Home hub, 2026-09-07). Home es el hub: strip semanal → Semana; tile grande **Hoy**; resto vía tiles. Back nativo del stack para volver.

Tipos: `src/types/navigation.ts` (`RootStackParamList` únicamente).

## Pantallas → API

| Pantalla | Módulos API |
|----------|-------------|
| `HomeScreen` | `schedule`, `today`, `workouts`, `water` (progreso del tile Agua; opcional, `.catch(() => null)`) |
| `HoyScreen` | `today`, `routines`, `workouts` (solo los de hoy), `water` (opcional) |
| `SesionScreen` | `today`, `exercises`, `routines`, `workouts`, `progress`, `bodyMetrics` (prefill de peso corporal) |
| `RoutinesScreen` | `exercises`, `routines` |
| `ScheduleScreen` | `schedule`, `routines` |
| `HistorialScreen` | `exercises`, `routines`, `workouts` (`GET /workouts/export`) |
| `ProgressScreen` | `exercises`, `progress` |
| `ObjetivosScreen` | `goals` |
| `UserScreen` | `bodyMetrics`, `today` |
| `AnalisisScreen` | `analytics` |
| `AguaScreen` | `water` (`/water`, `/water/containers`, `/water/history`, `/water/settings`, `/water/export`) |

## Estructura de carpetas

- `src/screens/` — una pantalla por fichero; refetch con `useFocusEffect`
- `src/api/` — un módulo por recurso REST; patrón `fetch` + `buildErrorMessage` (`http.ts`)
- `src/types/` — tipos TS (excepto `TodayResponse`, que vive en `api/today.ts`). `types/exercise.ts` define `WeightUnit = "kg" | "lb" | "bw"`.
- `src/components/` — `ExercisePickerList` (buscador, grupos, alta/edición de ejercicios), `SupersetBlock` (`collapsed` en Hoy post-save), `MenuTile`, `PrBadge`, `SessionBar` / `SessionClock` / `SessionPill`
- `src/utils/` — `number.ts` (coma decimal), `exercisePicker.ts` (grupos musculares), `superset.ts`, `weightUnit.ts` (etiqueta de unidad)
- `src/config.ts` — `EXPO_PUBLIC_API_URL`

## Convenciones obligatorias

1. **Refetch al foco:** `useFocusEffect` + `useRef` para callbacks actuales (evitar stale closures).
2. **Teclado:** `KeyboardAvoidingView` con `keyboardVerticalOffset={0}` (ya no hay tab bar que compensar). Los modales usan el mismo criterio.
3. **Fecha Today:** `todayIsoDate()` para `GET /today?date=`.
4. **Números:** normalizar coma decimal con `utils/number.ts`.
5. **Picker ejercicios:** siempre `ExercisePickerList` (buscador + agrupación + "+ Nuevo ejercicio" + edición). Usado en Rutinas (2 pickers), Hoy (entreno libre + superserie), Progreso, Historial. El formulario sirve para `POST /exercises` (`createExercise`) y `PUT /exercises/{id}` (`updateExercise`): nombre, chips kg/lb/PC (`bw` en API), grupo principal obligatorio y secundarios opcionales. El botón **Editar** es hermano del `renderItem`, no está anidado dentro de la zona seleccionable. El padre sincroniza su lista mediante `onCreated` y `onUpdated`.
6. **Estado:** `useState` local; sin Redux/Context global salvo necesidad real.
7. **Estilos:** `StyleSheet.create` inline por pantalla.
8. **CSV:** `File`/`Paths` de `expo-file-system` (API nueva; en SDK 58 el paquete va en `~58.x`). **No** usar `writeAsStringAsync` del import principal — lanza en runtime. Share con `expo-sharing` `shareAsync`. Sigue en Expo Go.

## Hoy, Sesión e Historial

**Hoy** (`HoyScreen`) es solo el resumen del día: rutina que toca, tarjeta de sesión (▶ Empezar / "Sesión en curso" con reloj + "Volver a la sesión"), entrenos ya guardados hoy (ejercicios, series, volumen, notas) y agua. Loguear ocurre en **Sesión**.

**Sesión y borrador (`src/session/SessionContext.tsx`):** el provider (en `App.tsx`) guarda el cronómetro (`startedAt`, `lastSetAt`) **y todo el borrador del entreno** (`formRows`, `formTarget`, `notes`, `submitted`, `savedSummaries`, `draftKeyRef`...). Así el entreno a medias sobrevive a salir a Agua, Historial, etc. mientras la sesión está en curso (antes un back a Home lo perdía). `stopSession()` ("■ Terminar", con confirmación si hay un entreno sin guardar) lo descarta todo y cancela el aviso. Una sesión puede abarcar varios entrenos; la duración que se añade al resumen al guardar cuenta desde el inicio de la sesión o desde el guardado anterior (`segmentStartRef`). Es estado en memoria: si iOS mata la app, la sesión y el borrador se pierden.

**Aviso de inactividad:** `expo-notifications` (notificación local, funciona en Expo Go iOS). Al empezar se pide permiso y se programa un `TIME_INTERVAL` de 2 h; `touch()` (cualquier edición de series, añadir/quitar serie, guardar) cancela y reprograma con debounce de 2 s. Cuerpo: "Ey, ¿sigues por aquí?…". Al terminar la sesión se cancela. Si el permiso se deniega, Hoy lo avisa. Plugin `expo-notifications` en `app.json` (solo importa en builds EAS).

**Hoy (lógica del formulario, ahora en `SesionScreen`):** `buildDraft` pre-rellena el peso de ejercicios `bw` con el último `BodyMetric` (`latestBodyWeight`). `fetchBodyMetrics().catch(() => [])` hace este dato opcional: si falla `/body-metrics`, Hoy sigue usable con pesos vacíos. El `draftKeyRef` existente evita reconstruir y pisar el formulario al hacer refocus mientras la clave fecha/rutina/ejercicios no cambie. Tras guardar (`submitted`), las tarjetas sueltas y `SupersetBlock` nacen colapsadas (solo nombre; tap reexpande). Estado local `expandedAfterSave` (Set de keys; vacío = todo colapsado). Mientras se edita, abiertas como antes. Al salir de la pantalla Sesión el borrador se conserva (vive en `SessionContext`) hasta "Terminar sesión".

**Sensaciones y asistencia (Sesión):** `notes` (en `SessionContext`) viaja en `POST /workouts`; Historial la muestra y la reenvía en `PUT` (omitirla la borraría). `SessionBar` (arriba de Hoy, solo mientras se edita) lleva cronómetro de sesión, descanso desde la última serie con reps escritas, "Siguiente: …" (primer ejercicio con alguna serie sin reps) y un tip estático (`utils/sessionTips.ts`). Estado `sessionStartedAt`/`lastSetAt` en `TodayScreen`; el tick de 1 s vive dentro de `SessionBar` para no re-renderizar toda la pantalla. `resetSession()` se llama cada vez que nace un formulario nuevo. Solo primer plano: la alarma real es ROADMAP #8.

**PR:** `bestWeights` (`Map<exercise_id, BestMark>`, `utils/pr.ts`) guarda mejor peso + `volumeKg` (máx. de `best_set_volume_kg` de `/progress`, `null` si el backend no lo manda). `prFlags` compara una serie contra el histórico: 🏆 (peso) y 💪 (volumen peso×reps, requiere reps > 0). `computePrFlags` lo aplica a toda la sesión y deja el badge solo en la **mejor serie por ejercicio** (peso y volumen por separado; empate → la primera), así 50 kg y luego 49 kg con récord previo de 45 solo marca el de 50. Devuelve `set.id → flags`; `TodayScreen` lo pasa a `SupersetBlock` como `prBySetId`. `PrBadge` pinta el resultado. El histórico se precarga solo para los ejercicios de la rutina del día.

**Agua:** `AguaScreen` — toque en recipiente = añade su capacidad; "Ajustar" abre modal con ¼ ½ ¾ 1 y ±50 ml, y avisa si difiere de la capacidad; >1500 ml pide confirmación; editar la capacidad de un recipiente avisa (no reescribe lo registrado). CSV con `utils/shareCsv.ts`.

**Historial:** en edición, "Añadir ejercicio" abre el mismo picker (puede crear uno). `PUT /workouts/{id}` ya aceptaba sets extra. Botón "Exportar CSV" arriba: `exportWorkoutsCsv()` → `new File(Paths.cache, "laystra-workouts.csv")` + `Sharing.shareAsync`.

**Unidades en UI:** `formatWeightUnit` (`src/utils/weightUnit.ts`) transforma `bw` en `PC`; kg/lb pasan sin cambios. Se usa en placeholders y textos de Hoy, Historial, Progreso y `SupersetBlock`. Tras `PUT /exercises/{id}` (`onUpdated`): Historial recarga workouts y convierte el borrador de edición; Progreso recarga `/progress`; Hoy convierte las series del draft y refresca el PR. `convertWeight` duplica `LB_TO_KG` del backend.

**Análisis:** `week_tonnage` se muestra en kg. El backend normaliza lb a kg y trata bw como kg antes de calcularlo, por lo que la etiqueta sigue siendo correcta.

## Contrato API

Tipos duplicados a mano respecto al backend. Mapa completo: `.cursor/rules/api-contract.mdc`.

Ejercicios: `types/exercise.ts` expone `WeightUnit = "kg" | "lb" | "bw"` y `api/exercises.ts` implementa GET, POST y `updateExercise` para `PUT /exercises/{id}`.

Catálogos sincronizados manualmente:
- `MUSCLE_GROUP_ORDER` (`utils/exercisePicker.ts`) ↔ `muscle_taxonomy.py`
- `WeightUnit` (`backend/app/units.py`) ↔ `types/exercise.ts` + `utils/weightUnit.ts`
- `validSupersetGroups` (`utils/superset.ts`) ↔ `services/superset.py`

## Verificación

```bash
npm run typecheck   # desde mobile/
```

Sin tests unitarios por ahora — verificación en dispositivo vía Expo Go o build EAS `preview`.

## Build

Sin Mac — iOS vía EAS. Ver `eas.json` y subagente `eas-agent`. Salir de Expo Go implica development build.

Dependencias nativas en Expo Go (directas en `package.json`): `expo-file-system` / `expo-sharing` en la línea SDK 58. No fuerzan development build. Un build EAS `preview` anterior a v2/SDK 57 hay que reconstruirlo para CSV y para el bump de SDK.
