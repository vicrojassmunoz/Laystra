# Backend architecture

FastAPI app for Laystra. Fase 0 state: full MVP endpoint surface, backed by an in-memory seeded store — no database yet.

## Estado (dónde vive el dato)

Todo vive en `InMemoryStore` (`app/services/store.py`), un singleton importado por los routers (`from app.services.store import store`). Se siembra con datos de ejemplo al arrancar (`_seed()`: 5 ejercicios, 2 rutinas — "Push day" y "Pierna" —, `schedule[0]` = Push day (lunes), `schedule[2]` = Pierna (miércoles), resto de días vacíos).

**Se resetea al reiniciar el servidor.** No hay persistencia real todavía — SQLite llega en Fase 1. En los tests, `tests/conftest.py` reinicializa el store (`store.__init__()`) antes de cada test vía un fixture `autouse`, así que los tests no comparten estado entre sí aunque el store de producción sí sea un singleton mutable a lo largo de la vida del proceso.

## Endpoints

### `app/routers/health.py`
- `GET /health` → `{"status": "ok"}`

### `app/routers/exercises.py` (prefix `/exercises`)
- `GET /exercises` → lista de `Exercise`
- `POST /exercises` → crea un `Exercise` (201)
- `GET /exercises/{id}/progress` → `ProgressResponse`: por cada `Workout` que contenga sets de ese ejercicio, un `ProgressPoint` con `best_weight` (máximo peso de esos sets) y `total_reps` (suma de reps), ordenado por fecha ascendente. 404 si el ejercicio no existe.

### `app/routers/routines.py` (prefix `/routines`)
- `GET /routines` → lista de `Routine` (cada una con sus `RoutineExercise` embebidos)
- `POST /routines` → crea rutina + sus `RoutineExercise` en una sola llamada (201). 404 si algún `exercise_id` referenciado no existe.
- `GET /routines/{id}` → 404 si no existe

### `app/routers/schedule.py` (prefix `/schedule`)
- `GET /schedule` → los 7 días (0-6) con su `routine_id` (o `null`)
- `PUT /schedule/{day}` → asigna/limpia la rutina de un día. 422 si `day` fuera de 0-6, 404 si el `routine_id` no existe (null es válido, limpia el día)

### `app/routers/today.py`
- `GET /today?date=YYYY-MM-DD` → **`date` es un query param obligatorio**, no hay default ni se usa el reloj del servidor. Decisión deliberada: el cliente (el móvil) calcula "hoy" en su propia zona horaria y se lo pasa al backend; evita que un backend alojado en otra zona horaria (Fase 4) calcule mal el día alrededor de medianoche. Devuelve `day_of_week` (`date.weekday()`: lunes=0), la rutina asignada ese día (o `null` si es descanso) y su lista de ejercicios ya resueltos (nombre, unidad, sets/reps objetivo) listos para pre-rellenar el log.

### `app/routers/workouts.py` (prefix `/workouts`)
- `GET /workouts` → lista ordenada por fecha descendente
- `POST /workouts` → crea workout + sus `WorkoutSet` (201). 404 si `routine_id` o algún `exercise_id` de los sets no existen.
- `GET /workouts/{id}` → 404 si no existe

## Modelo de datos (schemas Pydantic reales)

- `Exercise` (`schemas/exercise.py`): `id`, `name`, `unit` (`"kg"` | `"lb"`, default `"kg"`)
- `RoutineExercise` (`schemas/routine.py`): `id`, `routine_id`, `exercise_id`, `target_sets` (>0), `target_reps` (>0), `order` (≥0)
- `Routine`: `id`, `name`, `exercises: list[RoutineExercise]`
- `ScheduleEntry` (`schemas/schedule.py`): `day` (0-6), `routine_id | null`
- `WorkoutSet` (`schemas/workout.py`): `id`, `workout_id`, `exercise_id`, `weight` (≥0), `reps` (≥0), `order` (≥0)
- `Workout`: `id`, `date`, `routine_id | null`, `sets: list[WorkoutSet]`
- `TodayResponse` / `TodayExercise` (`schemas/today.py`): shape de solo-lectura para la pantalla "Hoy", no se persiste
- `ProgressResponse` / `ProgressPoint` (`schemas/progress.py`): shape de solo-lectura calculado on-the-fly, no se persiste

Todos los `*Create` (p.ej. `ExerciseCreate`, `RoutineCreate`, `WorkoutCreate`) son la versión de entrada sin `id` (y sin los ids de las relaciones que el servidor asigna).

## Decisiones no obvias

- **Validación en el borde**: `Field(gt=0)` / `Field(ge=0)` en los schemas rechaza reps negativas, sets/reps en cero, etc., directamente en la capa de Pydantic — antes de que la lógica de negocio los vea. Un valor inválido devuelve 422 automáticamente.
- **CORS abierto** (`main.py`): `allow_origins=["*"]`. Deliberado — app personal de un solo usuario, sin auth, todavía en LAN. Revisar si esto cambia (Fase 4, hosting público).
- **IDs autoincrementales en memoria**: cada entidad tiene su propio contador (`next_exercise_id()`, etc.) en `InMemoryStore`, no hay UUIDs. Se reinician a 1 en cada reset del store (incluido cada test).
