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
├── Eventos       (fechas objetivo/cuenta atrás; antes "Objetivos", mismo recurso `goals`)
├── Habitos       (hábitos diarios + recordatorios)
├── Perfil (User)
├── Agua
└── Análisis
```

`Sesion` acepta el param `{ quick?: boolean }` (Sesión rápida; ver más abajo). `SessionPill` (flotante, fuera del navigator pero dentro del `NavigationContainer`) aparece en cualquier pantalla menos `Sesion` mientras hay sesión en curso; toque → `Sesion`. `App.tsx` envuelve todo en `SessionProvider`, llama a `useHabitReminders()` en `Root` y usa `createNavigationContainerRef` + `onStateChange` para saber la ruta visible.

Sin bottom tab bar (ROADMAP #10 del Home hub, 2026-09-07). Home es el hub: strip semanal → Semana; tile grande **Hoy**; resto vía tiles. Back nativo del stack para volver.

Tipos: `src/types/navigation.ts` (`RootStackParamList` únicamente).

## Pantallas → API

| Pantalla | Módulos API |
|----------|-------------|
| `HomeScreen` | `schedule`, `today`, `workouts`, `water` (tile Agua; opcional), `goals` (próximo evento), `habits` (`/habits/today`), `steps` vía `useSteps` |
| `HoyScreen` | `today`, `routines`, `workouts` (solo los de hoy), `water` (opcional) |
| `SesionScreen` | `today`, `exercises`, `routines` (lee y `createRoutine` para "Guardar como rutina"), `workouts` (`createWorkout` con `duration_seconds`), `progress`, `bodyMetrics` (prefill de peso corporal) |
| `RoutinesScreen` | `exercises`, `routines` |
| `ScheduleScreen` | `schedule`, `routines` |
| `HistorialScreen` | `exercises`, `routines`, `workouts` (`GET /workouts/export`) |
| `ProgressScreen` | `exercises`, `progress` |
| `EventosScreen` | `goals` |
| `HabitosScreen` | `habits` (CRUD, `/habits/today`, `/habits/{id}/log`), y `syncHabitReminders` al guardar |
| `UserScreen` (Perfil) | `bodyMetrics`, `workouts` (export CSV), `water` (export CSV); `InjuriesSection` → `injuries`; foto/nombre solo locales (`utils/profilePhoto.ts`); descanso por defecto solo local (`utils/restTimer.ts`) |
| `AnalisisScreen` | `analytics` |
| `AguaScreen` | `water` (`/water`, `/water/containers`, `/water/history`, `/water/settings`, `/water/export`) |

## Estructura de carpetas

- `src/screens/` — una pantalla por fichero; refetch con `useFocusEffect`
- `src/api/` — un módulo por recurso REST; patrón `fetch` + `buildErrorMessage` (`http.ts`)
- `src/types/` — tipos TS (excepto `TodayResponse`, que vive en `api/today.ts`). `types/exercise.ts` define `WeightUnit = "kg" | "lb" | "bw"`.
- `src/components/` — `ExercisePickerList` (buscador, grupos, alta/edición de ejercicios; avisa de lesiones activas), `SupersetBlock` (`collapsed` en Hoy post-save), `MenuTile`, `PrBadge`, `SessionBar` / `SessionClock` / `SessionPill`, `SheetHeader` (cabecera de hoja modal: título + "Cerrar" siempre visible, fuera de cualquier `ScrollView`; usada en todos los pickers de Sesión, Rutinas e Historial), `BarChart` (Progreso y BodyProgress), `PickerField` (fecha/hora opcional: `datetimepicker` nativo, texto en web)
- `src/components/profile/` — `Avatar` (foto redonda; cae a iniciales o icono si no hay foto o falla la carga), `BodyProgress` (inicio vs ahora, variación, tendencia 30 días y gráfica del peso), `InjuriesSection` (CRUD de lesiones en hoja modal)
- `src/utils/` — `number.ts` (coma decimal), `exercisePicker.ts` (grupos musculares), `superset.ts`, `weightUnit.ts` (etiqueta de unidad), `date.ts` (`isoOf`, `todayIsoDate`), `duration.ts`, `events.ts`, `injuryMap.ts`, `useActiveInjuries.ts`, `profilePhoto.ts`, `steps.ts` + `useSteps.ts`, `habitReminders.ts` + `useHabitReminders.ts`, `restTimer.ts` (descanso por defecto), `useKeyboardVisible.ts` (true mientras hay teclado; iOS usa `keyboardWill*` para reajustar a la vez que la animación; lo usa `ExercisePickerList`)
- `src/config.ts` — `EXPO_PUBLIC_API_URL`

## Convenciones obligatorias

1. **Refetch al foco:** `useFocusEffect` + `useRef` para callbacks actuales (evitar stale closures).
2. **Teclado:** `KeyboardAvoidingView` con `keyboardVerticalOffset={0}` (ya no hay tab bar que compensar). Los modales usan el mismo criterio. Las hojas modales con buscador usan `SheetHeader` fuera del scroll para que "Cerrar" funcione con el teclado abierto.
3. **Fecha Today:** `todayIsoDate()` para `GET /today?date=`. Vive en `utils/date.ts` (hora LOCAL vía `isoOf`, nunca `toISOString`, que da UTC); `api/today.ts` la reexporta. Usar `isoOf(date)` para cualquier otra fecha local.
4. **Números:** normalizar coma decimal con `utils/number.ts`.
5. **Picker ejercicios:** siempre `ExercisePickerList` (buscador + agrupación + "+ Nuevo ejercicio" + edición). Usado en Rutinas (2 pickers), Hoy (entreno libre + superserie), Progreso, Historial. El formulario sirve para `POST /exercises` (`createExercise`) y `PUT /exercises/{id}` (`updateExercise`): nombre, chips kg/lb/PC (`bw` en API), grupo principal obligatorio y secundarios opcionales. El botón **Editar** es hermano del `renderItem`, no está anidado dentro de la zona seleccionable. El padre sincroniza su lista mediante `onCreated` y `onUpdated`.
6. **Estado:** `useState` local por pantalla; sin Redux. Único Context global: `SessionContext` (`useSession()`, provider en `App.tsx`) para sesión, cronómetro, descanso y borrador del entreno; no añadir más sin necesidad real. Preferencias locales sueltas (apariencia, descanso) van en AsyncStorage con try/catch ("best effort").
7. **Estilos:** `StyleSheet.create` inline por pantalla.
8. **CSV:** `File`/`Paths` de `expo-file-system` (API nueva; en SDK 58 el paquete va en `~58.x`). **No** usar `writeAsStringAsync` del import principal — lanza en runtime. Share con `expo-sharing` `shareAsync`. Sigue en Expo Go.

## Hoy, Sesión e Historial

**Hoy** (`HoyScreen`) es solo el resumen del día: rutina que toca, tarjeta de sesión (▶ Empezar / "Sesión en curso" con reloj + "Volver a la sesión"), entrenos ya guardados hoy (ejercicios, series, volumen, notas; cada tarjeta se despliega con "Ver ejercicios ▸" para ver cada ejercicio con sus series, vía `utils/workoutSummary.ts`, que agrupa por ejercicio en todo el workout, también super-series) y agua. Loguear ocurre en **Sesión**.

**Estados de sesión:** `active` = abierta (preparada o en marcha); `running` = el cronómetro corre (`startedAt !== null`). **Preparada** (`active && !running`): `prepareSession()` (Hoy → Empezar / Sesión rápida) abre la sesión sin cronómetro, para elegir ejercicios sin que cuente el tiempo; `startSession()` se llama desde `SesionScreen.updateSet` al escribir las primeras reps de la primera serie (arranca `startedAt`, `segmentStartRef` y el aviso de inactividad). Una sesión preparada no tiene pausa, ni descanso (`startRest` no hace nada), ni aviso de inactividad; `SessionBar` muestra `--:--` y la deshabilita la pausa.

**Sesión y borrador (`src/session/SessionContext.tsx`):** el provider (en `App.tsx`) guarda el cronómetro (`startedAt`, `lastSetAt`) **y todo el borrador del entreno** (`formRows`, `formTarget`, `notes`, `submitted`, `savedSummaries`, `draftKeyRef`...). Así el entreno a medias sobrevive a salir a Agua, Historial, etc. mientras la sesión está en curso (antes un back a Home lo perdía). **Pausa:** `pausedAt` congela los relojes (`SessionClock`/`SessionBar` miden contra el instante de pausa); `resumeSession()` desplaza `startedAt`, `lastSetAt` y `segmentStartRef` lo que duró la pausa y reprograma el aviso. En pausa `touch()` no programa nada. `stopSession()` ("■ Terminar", con confirmación si hay un entreno sin guardar) lo descarta todo y cancela el aviso. Una sesión puede abarcar varios entrenos; la duración que se añade al resumen al guardar cuenta desde el inicio de la sesión o desde el guardado anterior (`segmentStartRef`). Ver "Persistencia del borrador" abajo: sobrevive a que iOS mate la app.

**Persistencia del borrador (`SessionContext`):** mientras hay sesión activa (también preparada: entonces `startedAt` es `null`) el provider escribe en AsyncStorage (`laystra.sessionDraft.v1`) cronómetro, pausa, `restEndAt` (campo opcional: un borrador viejo sin él se lee como `null`, no exigió subir la clave), `formTarget`, `formRows`, `notes`, `submitted`, `skipped`, `savedSummaries`, `snapshot`, `routineSaved`, `draftKey` y `segmentStart`, con debounce de 400 ms; sin sesión borra la clave. Detalles no obvios:
- `hydrated`: `false` hasta intentar restaurar al abrir. `HoyScreen` deshabilita Empezar/Sesión rápida y `SesionScreen` no reconstruye el formulario mientras no sea `true` (si no, pisaría lo restaurado). Tampoco se escribe antes de hidratar.
- Se restaura también `draftKeyRef`; sin él `SesionScreen` recalcularía la clave desde `/today` y reconstruiría el formulario.
- Caducidad: se descarta si `savedAt` tiene más de 18 h **o** si el día del borrador (fecha de su `draftKey`, o de `startedAt`) no es hoy. Un JSON inválido (`parseDraft`, que valida también `segmentStart` y `draftKey`) se ignora.
- `persistNow()`: marca el próximo guardado como inmediato (sin debounce). `SesionScreen` lo llama tras `createWorkout` OK, para que un kill de iOS antes del debounce no deje el borrador "sin guardar" y permita duplicar el entreno.
- `routineSaved`: "Guardar como rutina" ya hecho para el entreno libre actual; también persiste.
- Cambiar la forma de `ExerciseDraft` (o `TodayExercise`/`SetDraft`) obliga a subir la clave a `.v2`: el borrador viejo se restauraría sin validar la forma.

**Duración (`duration_seconds`):** `createWorkout` la manda (segundos del tramo `segmentStartRef` → ahora, o → instante de pausa si está pausada; `null` sin sesión) y `updateWorkout` en Historial la reenvía (`?? null`; omitirla la borraría). `utils/duration.ts` → `formatDuration(seconds)` ("52 min", "1 h 05 min", `null` si no hay dato) la muestra en Hoy e Historial. Si el borrador cambia de día/rutina el tramo se reinicia (no cuenta la noche).

**Sesión rápida y Guardar como rutina:** Hoy navega a `Sesion` con `{ quick: true }`. Un **único efecto** en `SesionScreen` (ya hidratada y con `/today` cargado) decide entre sesión rápida y rutina de hoy: limpia el param (`setParams`) y, si es quick y no hay entreno a medias ni resúmenes guardados, crea un `formTarget` libre (`routineId: null`) y abre el picker; si no, construye el formulario desde la rutina de hoy. Tarjetas de ejercicio con `key` estable (id de la primera serie). `removeExercise` pide confirmación. `formTarget.exercises` no se modifica al añadir ejercicios: `formRows` es la fuente de verdad. Un ejercicio creado en el paso `"add"` del picker entra al catálogo y también al formulario. "Guardar como rutina" (`createRoutine`, solo entrenos libres con series con reps; ejercicios y `target_sets` salen de `buildRoutineExercises`) aparece como botón tras guardar y, al **Completar** un entreno libre, como hoja previa al cierre (guardar o "Ahora no" continúan el cierre; el cierre del usuario se ignora mientras se guarda).

**Foto de perfil (`utils/profilePhoto.ts`):** `expo-image-picker` (recorte 1:1) → copia a `Paths.document` con nombre `profile-<timestamp>.jpg` (nuevo cada vez para evitar caché de `<Image>`); en AsyncStorage (`profile:photoFile`) se guarda **solo el nombre del fichero**, no la ruta absoluta, porque iOS puede cambiar el UUID del contenedor entre actualizaciones; la URI se resuelve en cada `loadProfilePhotoUri`. Si el fichero ya no existe se limpia la clave. El nombre del perfil va en `profile:name`. En web la foto vive en memoria. Todo es local: nada va al backend.

**Lesiones (Perfil + avisos):** `InjuriesSection` hace CRUD sobre `/injuries` (`PUT` es reemplazo total: reenviar todos los campos, también para activar/desactivar). `utils/injuryMap.ts` define `BODY_AREAS`, `SEVERITIES` y `BODY_AREA_MUSCLES` (zona → grupos musculares del catálogo cerrado; aproximación gruesa que prefiere avisar de más; `otro` no avisa). `relatedInjuries`/`relatedAreas(exercise, injuries)` filtran lesiones **activas** que comparten grupo con el ejercicio (principal + secundarios). `useActiveInjuries()` carga `GET /injuries?active=true` al montar y devuelve `[]` si falla (el aviso nunca rompe la pantalla). `ExercisePickerList` lo usa para marcar ejercicios con aviso; la app nunca declara un ejercicio seguro o inseguro. `BodyProgress` usa `bodyMetrics` ya cargados por `UserScreen`.

**Pasos:** `utils/steps.ts` lee el podómetro (`expo-sensors` `Pedometer`) día a día (00:00-24:00 locales; hoy hasta ahora) para hoy y hasta 7 días atrás (iOS guarda ~7) y hace `putSteps(date, steps)` por cada día con >0 (tope 500 000). El backend conserva el máximo del día, así que subir menos no reduce. Un día sin dato del sensor se salta; el primer fallo de red corta el bucle. `useSteps()` (usado en Home; `runningRef` evita sincronizaciones solapadas) sincroniza al montar y al volver a primer plano (`AppState`), pide permiso una sola vez, expone `{ permission, today, activate }` (`activate` abre Ajustes si ya está denegado, porque iOS no vuelve a preguntar). Valor de `today`: se lee el podómetro local y `GET /steps`; si la lectura local es `>=` lo sincronizado se muestra la local (más reciente), si es menor se muestra el del backend (conserva el máximo del día, nunca baja); si el backend falla, respaldo con el valor local. Home etiqueta la tarjeta "Pasos del iPhone (no incluye pulsera ni reloj)" (solo cuenta el podómetro del teléfono). La meta sale del `target` del hábito `steps` (`stepsGoalFrom`; por defecto `STEPS_GOAL = 8000`). Tras sincronizar llama a `syncHabitReminders()`.

**Hábitos (`HabitosScreen`, `api/habits.ts`, `types/habit.ts`):** tipos `water | steps | check | count`; `water` y `steps` derivan su progreso en el backend, `check` (0|1) y `count` (0..1e6) se registran con `logHabit`. `GET /habits` devuelve todos; `/habits/today?date=` solo activos con progreso. Los recordatorios (`reminder_time` "HH:MM") son notificaciones locales (`utils/habitReminders.ts`):
- Ids estables `habit-<id>-<fecha>`: reprogramar el mismo día reemplaza. **Solo se cancelan los ids con prefijo `habit-`** (`cancelOwn`): la notificación de inactividad de sesión usa otro id y no se toca.
- `DAYS_AHEAD = 3` por hábito: iOS conserva como máximo 64 notificaciones locales pendientes por app; con 3 días caben ~21 hábitos con recordatorio y la ventana se rellena en cada sincronización.
- `syncHabitReminders()` está serializada y agrupada (una sola pasada en cola). Lee datos primero: si el backend falla deja los recordatorios existentes; sin permiso cancela los propios. El de hoy se omite si el hábito ya está cumplido y no se programan horas pasadas.
- `useHabitReminders()` (en `Root`) sincroniza al abrir y al volver a primer plano. `ensureReminderPermission()` solo se pide al guardar un hábito con recordatorio (no se pregunta a quien no los usa).
- Web: `SUPPORTED = Platform.OS !== "web"`; todo se salta.

**Eventos (`EventosScreen`, `utils/events.ts`):** fechas objetivo sobre el recurso `goals` (`target_date`). `daysUntil(iso, todayIso)`, `countdownLabel(days)` y `nextEvent(goals, todayIso)` (el pendiente con fecha más cercano, hoy o futuro; lo muestra Home). `PickerField` es el campo opcional de fecha/hora (`mode: "date" | "time"`, valor `"AAAA-MM-DD"` / `"HH:MM"` o `null`; reutilizado en Hábitos para `reminder_time`).

**Completar:** `SessionBar` tiene Pausa (icono), **Completar** y Terminar (icono). `handleComplete` cuenta series con reps: completo → `handleSave({ finishAfter })`; a medias → aviso y `handleSave({ partial: true, finishAfter: true })`, que filtra las series sin reps antes de validar (también para `validSupersetGroups`) y, tras guardar, hace `stopSession()` + reset a Home → Hoy; nada hecho → ofrece terminar sin guardar.

**Aviso de inactividad:** `expo-notifications` (notificación local, funciona en Expo Go iOS). El permiso se pide en `prepareSession` (toque explícito, antes de empezar, para que el diálogo de iOS no se cruce con el teclado); `startSession` programa un `TIME_INTERVAL` de 1 h (`INACTIVITY_SECONDS`). La notificación usa identifier fijo `"laystra.inactivity"` (`INACTIVITY_ID`) y se cancela **siempre por ese id**; `touch()` (cualquier edición de series, añadir/quitar serie, guardar) cancela y reprograma con debounce de 2 s. Cuerpo: "Ey, ¿sigues por aquí? Llevas 1 h…". Al terminar la sesión se cancela. Si el permiso se deniega, Hoy lo avisa. Plugin `expo-notifications` en `app.json` con `enableRemoteNotifications: false`: solo se usan notificaciones **locales**, así que NO se pide el entitlement `aps-environment` (push). Sin esa opción el build EAS ad-hoc falla porque el provisioning profile no tiene la capability Push Notifications.

**Temporizador de descanso:** la duración por defecto es global (`utils/restTimer.ts`: `REST_OPTIONS` 60/90/120/180 s, `DEFAULT_REST_SECONDS` 90, AsyncStorage `laystra.restSeconds`, válido 10 s–1 h). Variable de módulo con `getRestSeconds()` síncrono (lo lee `SessionContext`; `loadRestSeconds()` se llama al hidratar) y hook `useRestSeconds()` (usado por el selector de chips en Perfil, `formatRestLabel`). `SessionContext` expone `restEndAt` (ms epoch del fin; `null` = sin descanso; si ya pasó se queda en 0 hasta saltar o completar otra serie), `startRest()` (lo llama `SesionScreen.updateSet` cuando una serie pasa de sin reps a con reps, y reinicia el anterior), `adjustRest(±s)` (restar hasta 0 = saltar; `SessionBar` ofrece ±15 s) y `skipRest()`. Fin de la cuenta = hora absoluta, por eso sobrevive a matar la app (se persiste en el borrador y se reprograma al restaurar). Aviso: notificación local con id fijo `"laystra.rest"` (`REST_ID`, `TIME_INTERVAL`), reprogramar sustituye y se cancela siempre por id (nunca `cancelAll`, para no tocar `habit-*` ni `laystra.inactivity`); se cancela al pausar (la pausa congela el descanso) y `resumeSession` desplaza `restEndAt` lo que duró la pausa y reprograma; también al saltar/terminar. Con la app en primer plano el `setNotificationHandler` global (en `SessionContext`) suprime banner y sonido solo para `laystra.rest` (el resto se muestra) y un efecto dispara `haptic.success()` al llegar a 0 (solo si `AppState` es `active` y pasaron <3 s). `SessionBar` pinta la cuenta atrás ("Descanso", verde al acabar, botones −15 s/+15 s/Saltar, "Listo" al terminar). Limitación: iOS no permite alarma en bucle; es el sonido estándar de notificación y respeta silencio y Concentración.

**Añadir/Quitar ejercicio en sesión (`SesionScreen`):** `openAddExercise()` abre el paso `"add"` del picker (`SheetHeader` "Añadir ejercicio"); `addExerciseToForm` añade un ejercicio con 1 serie vacía y `target_sets: 1` a `formRows` (también en sesión preparada). `removeExercise(index)` lo quita con confirmación si tiene series con reps (no aplica a bloques de superserie: ahí se quitan rondas). Ambos llaman a `touch()`.

**Hoy (lógica del formulario, ahora en `SesionScreen`):** `buildDraft` pre-rellena el peso de ejercicios `bw` con el último `BodyMetric` (`latestBodyWeight`). `fetchBodyMetrics().catch(() => [])` hace este dato opcional: si falla `/body-metrics`, Hoy sigue usable con pesos vacíos. El `draftKeyRef` existente evita reconstruir y pisar el formulario al hacer refocus mientras la clave fecha/rutina/ejercicios no cambie. Tras guardar (`submitted`), las tarjetas sueltas y `SupersetBlock` nacen colapsadas (solo nombre; tap reexpande). Estado local `expandedAfterSave` (Set de keys; vacío = todo colapsado). Mientras se edita, abiertas como antes. Al salir de la pantalla Sesión el borrador se conserva (vive en `SessionContext`) hasta "Terminar sesión".

**Sensaciones y asistencia (Sesión):** `notes` (en `SessionContext`) viaja en `POST /workouts`; Historial la muestra y la reenvía en `PUT` (omitirla la borraría). `SessionBar` (arriba de `SesionScreen`, solo mientras se edita) lleva cronómetro de sesión, cuenta atrás de descanso (ver "Temporizador de descanso"), "Siguiente: …" (primer ejercicio con alguna serie sin reps) y un tip estático (`utils/sessionTips.ts`). `startedAt`/`lastSetAt`/`restEndAt` viven en `SessionContext` (`SesionScreen` los renombra a `sessionStartedAt`); el tick de 1 s vive dentro de `SessionBar` para no re-renderizar toda la pantalla.

**PR:** `bestWeights` (`Map<exercise_id, BestMark>`, `utils/pr.ts`) guarda mejor peso + `volumeKg` (máx. de `best_set_volume_kg` de `/progress`, `null` si el backend no lo manda). `prFlags` compara una serie contra el histórico: 🏆 (peso) y 💪 (volumen peso×reps, requiere reps > 0). `computePrFlags` lo aplica a toda la sesión y deja el badge solo en la **mejor serie por ejercicio** (peso y volumen por separado; empate → la primera), así 50 kg y luego 49 kg con récord previo de 45 solo marca el de 50. Devuelve `set.id → flags`; `SesionScreen` lo pasa a `SupersetBlock` como `prBySetId`. `PrBadge` pinta el resultado. El histórico se precarga solo para los ejercicios de la rutina del día.

**Agua:** `AguaScreen` — toque en recipiente = añade su capacidad; "Ajustar" abre modal con ¼ ½ ¾ 1 y ±50 ml, y avisa si difiere de la capacidad; >1500 ml pide confirmación; editar la capacidad de un recipiente avisa (no reescribe lo registrado). CSV con `utils/shareCsv.ts`.

**Historial:** en edición, "Añadir ejercicio" abre el mismo picker (puede crear uno). `PUT /workouts/{id}` ya aceptaba sets extra. Botón "Exportar CSV" arriba: `exportWorkoutsCsv()` → `new File(Paths.cache, "laystra-workouts.csv")` + `Sharing.shareAsync`.

**Unidades en UI:** `formatWeightUnit` (`src/utils/weightUnit.ts`) transforma `bw` en `PC`; kg/lb pasan sin cambios. Se usa en placeholders y textos de Hoy, Historial, Progreso y `SupersetBlock`. Tras `PUT /exercises/{id}` (`onUpdated`): Historial recarga workouts y convierte el borrador de edición; Progreso recarga `/progress`; Hoy convierte las series del draft y refresca el PR. `convertWeight` duplica `LB_TO_KG` del backend.

**Análisis:** `week_tonnage` se muestra en kg. El backend normaliza lb a kg y trata bw como kg antes de calcularlo, por lo que la etiqueta sigue siendo correcta.

## Sistema de diseño

Visual world "Native Calm" documentado en [`DESIGN.md`](../../DESIGN.md) (raíz). Código en `src/theme/theme.ts` (tokens claro/oscuro, `makeStyles`, `useTheme`) y `src/components/ui/` (`Txt`, `Screen`, `Card`/`Section`, `Row`, `Button`, `Chip`, `TextField`, `ProgressBar`, `Icon`). Todas las pantallas están rediseñadas con el sistema nuevo. Solo las filas y hojas de los pickers de ejercicio (en Sesión, Rutinas e Historial) siguen con estilos antiguos con tema (`components/ui/compat`: mismo API que `Text`/`TextInput`/`Button` nativos pero con colores del tema). Títulos en línea en la cabecera nativa. Modo Oscuro: `app.json` en `automatic`; Perfil → Apariencia guarda la preferencia (`src/theme/appearance.ts`, AsyncStorage + `Appearance.setColorScheme`). Iconos: SF Symbols en iOS (`expo-symbols`), Ionicons como sustituto en web.

## Movimiento

Reglas y valores en [`DESIGN.md`](../../DESIGN.md) → *Motion*. Código: `src/motion/motion.ts` (curvas, duraciones, `transition()` para las propiedades CSS de Reanimated, `haptic.*`), `components/ui/PressableScale` y `FadeInView`. Los hápticos no hacen nada en web.

## Vista previa en navegador (web)

`npx expo start --web` (o `w` en el menú de `expo start`) sirve la misma app con `react-native-web` en `http://localhost:8081`. **Es solo para iterar diseño y layout** (más rápido que Expo Go, y se puede abrir en el modo móvil de las DevTools); el iPhone sigue siendo la verdad final: SF vs fuente del navegador, cabecera/gestos nativos, safe areas, hápticos y animaciones del sistema no coinciden.

Lo que cambia en web, y por qué hay helpers:
- `Alert.alert` no hace nada en react-native-web → siempre `showAlert` de `src/utils/alert.ts` (misma firma; usa `window.alert/confirm` en web).
- CSV: `src/utils/shareCsv.ts` descarga el fichero en web y usa `expo-file-system` + `expo-sharing` (importados dinámicamente) en iOS.
- Notificaciones locales no existen en web: `SessionContext` las salta (`NOTIFICATIONS_SUPPORTED`: inactividad y descanso); el cronómetro, la pausa y la cuenta atrás en pantalla funcionan igual (el háptico no hace nada).
- El navegador llama al backend por CORS (`allow_origins=["*"]`); `EXPO_PUBLIC_API_URL` sirve tal cual.

## Contrato API

Tipos duplicados a mano respecto al backend. Mapa completo: `.cursor/rules/api-contract.mdc`.

Ejercicios: `types/exercise.ts` expone `WeightUnit = "kg" | "lb" | "bw"` y `api/exercises.ts` implementa GET, POST y `updateExercise` para `PUT /exercises/{id}`.

Tipos v3: `types/habit.ts` (`Habit`, `HabitPayload`, `HabitProgress`), `types/injury.ts` (`Injury`, `InjuryInput`, `BodyArea`, `Severity`), `types/steps.ts` (`StepsDay`), `types/workout.ts` (`duration_seconds?: number | null`). Endpoints: `/habits`, `/habits/today`, `/habits/{id}/log`, `/injuries` (`?active=`), `/steps` (`?days=&end=`) y `PUT /steps/{date}`.

Catálogos sincronizados manualmente:
- `BodyArea` / `Severity` (`types/injury.ts`, `utils/injuryMap.ts`) ↔ schemas de `injury` del backend; `BODY_AREA_MUSCLES` debe usar nombres de `MUSCLE_GROUP_ORDER`
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

**v3 — requieren build nativo nuevo** (módulos y permisos nativos declarados en `app.json` → `plugins`; un build EAS `preview` anterior no los lleva):
- `expo-image-picker` (foto de perfil; `photosPermission`).
- `expo-sensors` (podómetro; `motionPermission`).
- `@react-native-community/datetimepicker` (`PickerField`).
- `expo-notifications` ya existía (solo locales, `enableRemoteNotifications: false`); los recordatorios de hábitos la reutilizan.
Los tres primeros se importan o usan de forma que en web no rompen (picker y file-system con `import()` dinámico; `PickerField` cae a texto; `Pedometer` devuelve `unavailable`), pero la comprobación real debe hacerse en dispositivo.
