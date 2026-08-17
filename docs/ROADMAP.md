# Roadmap de ideas futuras — App de progreso físico

No tocan el MVP actual (rutinas + calendario + log + progreso, ver [MVP.md](MVP.md)). No implementar nada de aquí a menos que se pida explícitamente. Features ya entregadas: [CHANGELOG.md](CHANGELOG.md).

---

## ⚠️ Antes de nada: backup de datos

`laystra.db` vive en un único volumen Docker (`laystra-db`, ver `backend/docker-compose.yml`), sin ninguna copia fuera de ese PC. Un disco muerto, una reinstalación de Windows o un `docker volume prune` accidental se llevan por delante todo el histórico real.

**Solución barata:** job programado (sidecar con cron, o Task Scheduler) que corra `sqlite3 laystra.db ".backup /ruta/copia.db"` (o `VACUUM INTO`, consistente aunque el backend esté escribiendo) y suba el resultado fuera del PC — cloud storage barato o una carpeta OneDrive/Drive ya sincronizada. Frecuencia diaria sobra para una app personal.

---

## Backlog priorizado

### Ahora — coste barato

| # | Ítem | Depende de | Descripción |
|---|------|------------|--------------|
| 1 | PRs (récords personales) por ejercicio | — | Query de agregación sobre `WorkoutSet`: peso máximo y mejor serie por volumen (peso×reps) por ejercicio. Payoff en un badge inline en "Hoy" al batir un récord, no solo enterrado en Progreso. |
| 2 | `BodyMetric`: peso corporal / % grasa | — | Entidad nueva (fecha, peso, %grasa opcional) + una pantalla + un endpoint. |
| 3 | Contenido real para la pantalla `Análisis` | — | Tonelaje semanal (Σ peso×reps) y volumen por grupo muscular (usa `muscle_group_primary`, ya en el modelo), sobre datos existentes. |
| 4 | "Llevas X días sin entrenar [grupo muscular]" | — | Query sobre `WorkoutSet` + `Workout.date` agrupando por músculo (`Exercise.muscle_group_primary`, ya en el modelo). Sin tabla `Muscle` nueva. Candidata para `Análisis` o badge en `Home`. |
| 5 | Colapsar/expandir ejercicios en "Hoy" tras guardar | — | Cada tarjeta guardada se colapsa a solo el nombre (tocar para reexpandir). Puramente UI, estado local. |
| 6 | Crear ejercicios nuevos desde la app, con selector kg/lb | — | `POST /exercises` ya soporta `unit`; falta un "+ Nuevo ejercicio" en el picker modal de `RoutinesScreen.tsx`. |
| 7 | Añadir un ejercicio nuevo al editar un Entreno pasado | — | Hoy la edición de un `Workout` solo permite tocar ejercicios que ya tenía. Reutiliza el picker modal de `RoutinesScreen.tsx`. |
| 8 | Exportar el registro de entrenos a CSV | — | Endpoint que recorra `Workout`/`WorkoutSet` y devuelva CSV. En móvil: `expo-sharing` + `expo-file-system` (ya en Expo Go). |
| 9 | Sensaciones en el registro | — | Campo `notes` (texto libre) en `WorkoutSet` o `Workout`. Que una IA las lea depende del ítem 17. |
| 10 | Asistencia en directo durante la sesión (sin notificaciones) | — | Timer de sesión + info del siguiente ejercicio + tips rotando (texto estático) + log rápido en el descanso. Todo en Expo Go. |
| 11 | Buscador/agrupación por músculo en el picker de `ProgressScreen` | — | Mismo tratamiento que ya tienen los pickers de `RoutinesScreen.tsx`/`TodayScreen.tsx` — `ExercisePickerList.tsx` ya es compartido, extensión trivial. |

### Después — coste medio

| # | Ítem | Depende de | Descripción |
|---|------|------------|--------------|
| 12 | Temporizador de descanso con alarma real | — | Notificaciones locales fiables con la app en background requieren salir de Expo Go a un **development build** (`eas-agent`). Primer salto de la app a build nativo — todo lo anterior sigue funcionando en Expo Go. |
| 13 | Home con silueta de cuerpo tapeable por grupo muscular | — | Viable con `react-native-svg`. Falta un asset SVG con regiones delimitadas y mapear cada región a una de las 8 categorías de `muscle_group_primary`/secundario ya existentes. |

### Algún día — coste grande

| # | Ítem | Depende de | Descripción |
|---|------|------------|--------------|
| 14 | Generalizar el modelo a `Goal`/`Session` con tipos (fuerza/cardio/otro) | — | **Decisión vigente: no generalizar todavía.** Meter running como objetivo real exige un `session_type` propio por tipo (fuerza: sets/reps/peso; cardio: distancia/tiempo/ritmo) — mejor decidido antes que migrado después de 50 entrenos logueados. Se retoma solo si cardio pasa a ser un plan real, no "por si acaso". |
| 15 | Modo "split"/balance de entrenamiento, desacoplado del calendario | Ítem 4 | El usuario define un split propio (categorías + frecuencia objetivo) y la app prioriza según desfase real ("llevas 9 días sin entrenar legs") en vez del día de la semana. Meter categorías no-fuerza reengancha con el ítem 14. |
| 16 | Análisis en directo durante la sesión | Ítems 10, 12 | Lógica reactiva mientras se loguea cada set, no post-sesión. Dejar para cuando el resto del flujo de sesión ya esté sólido y usado de verdad. |
| 17 | Modos visuales seleccionables (fitness / videojuego / minimalista) | Ítems 14 o 15 (piel "videojuego") | Tres pieles, preferencia local, sin backend. Toca cada pantalla (theming/context). Pulido, no razón de ser de la app. |
| 18 | IA para analizar el registro y ajustar/planificar | Resto del backlog | Endpoint que pasa el histórico a un LLM (la API de Claude encaja) y devuelve sugerencias. La dificultad real es tener histórico suficiente para que el análisis diga algo útil. |
| 19 | Integración con Strava | — | OAuth, guardar tokens, job de sync (webhook o polling) — infraestructura real. |
| 20 | Integración con Salud (Apple Health / HealthKit) | Ítem 12 | Requiere config plugin + development build sí o sí, no accesible desde Expo Go. |
