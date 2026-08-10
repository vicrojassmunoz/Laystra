# Backend architecture

FastAPI app for Laystra. Fase 1 state: full MVP endpoint surface, backed by real SQLite persistence via SQLAlchemy.

## Estado (dónde vive el dato)

El dato vive en SQLite, fichero `backend/laystra.db` (sibling de `pyproject.toml`, definido en `app/db.py` como `DB_PATH`). El engine y `SessionLocal` (sessionmaker) se declaran también en `app/db.py`, junto con `Base` (`DeclarativeBase`) y dos funciones:

- `init_db()` — crea las tablas que falten vía `Base.metadata.create_all`. **No hay Alembic/migraciones todavía** — pendiente para cuando haga falta versionar el esquema.
- `get_db()` — generador que abre/cierra una `Session` por request, inyectado en los routers vía `Depends(get_db)`.
- Un listener `@event.listens_for(engine, "connect")` ejecuta `PRAGMA foreign_keys=ON` en cada conexión nueva — SQLite ignora las FKs por defecto si no se activan explícitamente por conexión, así que sin esto los `ForeignKey` de `models.py` no se validaban de verdad a nivel de motor.

`app/main.py` usa un `lifespan` (`@asynccontextmanager`) que llama `init_db()` y luego `seed_if_empty()` (`app/seed.py`) al arrancar, antes de aceptar tráfico. `seed_if_empty(db)` siembra el mismo dataset de ejemplo que tenía el viejo store en memoria (5 ejercicios, rutinas "Push day"/"Pierna", schedule con lunes→Push, miércoles→Pierna) solo si la tabla `exercises` está vacía — seguro de llamar en cada arranque sin duplicar filas.

Los routers ya no importan un store singleton; reciben `db: Session = Depends(get_db)` y hacen queries SQLAlchemy directas (`db.query(...)`, `db.get(...)`, `db.add()`, `db.commit()`, `db.refresh()`). No existe `app/services/` — ese paquete y el `InMemoryStore` que contenía se eliminaron por completo al migrar.

**El dato ya sobrevive a un reinicio del servidor** (a diferencia de Fase 0). En los tests, `tests/conftest.py` usa un engine SQLite en memoria aparte (`sqlite:///:memory:` con `StaticPool`, para que la conexión no desaparezca entre usos) y overridea `get_db` vía `app.dependency_overrides[get_db]`, así que los tests nunca tocan `laystra.db` real. Un fixture `autouse` (`reset_db`) hace `Base.metadata.drop_all` + `create_all` + `seed_if_empty` antes de cada test, para que no compartan estado entre sí.

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
- `PUT /routines/{id}` → edición completa: `RoutineCreate` (mismo body que `POST /routines`) reemplaza `name` y toda la lista de `RoutineExercise` (se reasigna `routine.exercises`, así que el cascade `delete-orphan` borra las filas viejas). 404 si la rutina no existe o si algún `exercise_id` referenciado no existe.
- `DELETE /routines/{id}` → 204, borra la rutina. 404 si no existe. Los `ScheduleEntry`/`Workout` que apuntaban a ella no se borran ni bloquean el delete: `ondelete="SET NULL"` en esas FKs (ver más abajo) hace que SQLite les ponga `routine_id=null` a nivel de motor.

### `app/routers/schedule.py` (prefix `/schedule`)
- `GET /schedule` → siempre las 7 entradas (día 0=lunes .. 6=domingo), construidas en memoria a partir de lo que haya en `schedule_entries`; los días sin fila en la BD se rellenan con `routine_id: null` en vez de omitirse. Así el cliente no tiene que tratar "sin fila" y "día de descanso explícito" como casos distintos.
- `PUT /schedule/{day}` → asigna/limpia la rutina de un día. `day` se valida con `Path(ge=0, le=6)` de FastAPI, así que un valor fuera de rango da el 422 estándar de FastAPI (`detail` es una lista de errores de validación, no un string a mano). 404 si el `routine_id` no existe (`null` es válido, limpia el día).

### `app/routers/today.py`
- `GET /today?date=YYYY-MM-DD` → **`date` es un query param obligatorio**, no hay default ni se usa el reloj del servidor. Decisión deliberada: el cliente (el móvil) calcula "hoy" en su propia zona horaria y se lo pasa al backend; evita que un backend alojado en otra zona horaria (Fase 4) calcule mal el día alrededor de medianoche. Devuelve `day_of_week` (`date.weekday()`: lunes=0), la rutina asignada ese día (o `null` si es descanso) y su lista de ejercicios ya resueltos (nombre, unidad, sets/reps objetivo) listos para pre-rellenar el log.

### `app/routers/workouts.py` (prefix `/workouts`)
- `GET /workouts` → lista ordenada por fecha descendente
- `POST /workouts` → crea workout + sus `WorkoutSet` (201). 404 si `routine_id` o algún `exercise_id` de los sets no existen.
- `GET /workouts/{id}` → 404 si no existe

## Modelo de datos

### Tablas ORM (`app/models.py`, SQLAlchemy 2.0, `Mapped`/`mapped_column`)

- `Exercise` (`exercises`): `id`, `name`, `unit` (default `"kg"`)
- `Routine` (`routines`): `id`, `name`; `exercises: list["RoutineExercise"]` (relación 1:N, cascade `all, delete-orphan`, ordenada por `RoutineExercise.order`)
- `RoutineExercise` (`routine_exercises`): `id`, `routine_id` (FK), `exercise_id` (FK), `target_sets`, `target_reps`, `order`
- `ScheduleEntry` (`schedule_entries`): `id`, `day` (columna `unique`, 0-6 — una fila por día de la semana), `routine_id` (FK a `routines.id`, nullable, `ondelete="SET NULL"`)
- `Workout` (`workouts`): `id`, `date`, `routine_id` (FK a `routines.id`, nullable, `ondelete="SET NULL"`); `sets: list["WorkoutSet"]` (relación 1:N, mismo cascade/orden que `Routine.exercises`)
- `WorkoutSet` (`workout_sets`): `id`, `workout_id` (FK), `exercise_id` (FK), `weight`, `reps`, `order`

### Schemas Pydantic (`app/schemas/`)

Mismo shape que las tablas ORM, usados para request/response en los routers:

- `Exercise`, `RoutineExercise`, `Routine`, `ScheduleEntry`, `WorkoutSet`, `Workout` — reflejan 1:1 los modelos ORM de arriba.
- `TodayResponse` / `TodayExercise` (`schemas/today.py`): shape de solo-lectura para la pantalla "Hoy", no se persiste.
- `ProgressResponse` / `ProgressPoint` (`schemas/progress.py`): shape de solo-lectura calculado on-the-fly, no se persiste.

Los schemas de respuesta que se construyen directamente desde objetos ORM (`Exercise`, `Routine`, `RoutineExercise`, `Workout`, `WorkoutSet`) tienen `model_config = ConfigDict(from_attributes=True)` — patrón estándar FastAPI + SQLAlchemy para que `response_model` pueda serializar el objeto ORM sin convertirlo a dict a mano. `ScheduleEntry` no lo necesita porque los routers la siguen construyendo a mano (no siempre a partir de un único objeto ORM).

Todos los `*Create` (p.ej. `ExerciseCreate`, `RoutineCreate`, `WorkoutCreate`) son la versión de entrada sin `id` (y sin los ids de las relaciones que el servidor asigna).

## Decisiones no obvias

- **Validación en el borde**: `Field(gt=0)` / `Field(ge=0)` en los schemas rechaza reps negativas, sets/reps en cero, etc., directamente en la capa de Pydantic — antes de que la lógica de negocio los vea. Un valor inválido devuelve 422 automáticamente.
- **CORS abierto** (`main.py`): `allow_origins=["*"]`. Deliberado — app personal de un solo usuario, sin auth, todavía en LAN. Revisar si esto cambia (Fase 4, hosting público).
- **IDs autoincrementales de SQLite**: cada tabla usa el `id` autoincremental que da SQLite (`primary_key=True` en la columna), no hay UUIDs. En tests se reinician en cada test porque el fixture `autouse` recrea el esquema (`drop_all`/`create_all`) sobre el engine en memoria; en producción son estables mientras exista `laystra.db`.
- **Sin migraciones (Alembic)**: `init_db()` solo hace `create_all`, que crea tablas que no existan pero no altera las existentes. Cualquier cambio de esquema sobre un `laystra.db` ya poblado requiere migración manual (borrar el fichero en dev, o Alembic cuando llegue). Pendiente para cuando el esquema necesite versionarse de verdad.
- **FKs de SQLite activadas por conexión**: SQLite no aplica `FOREIGN KEY` por defecto salvo que cada conexión ejecute `PRAGMA foreign_keys=ON` (ver `app/db.py`). Sin el listener de conexión, las FKs declaradas en `models.py` existían solo como documentación del esquema y no bloqueaban inserts/deletes inválidos.
- **Borrar una rutina no bloquea ni arrastra en cascada**: `ScheduleEntry.routine_id` y `Workout.routine_id` usan `ondelete="SET NULL"` (`app/models.py`). Al hacer `DELETE /routines/{id}`, SQLite pone a `null` el `routine_id` de cualquier día de la semana o workout histórico que apuntara a esa rutina, en vez de lanzar un error de integridad o borrar esas filas. Esto depende del `PRAGMA foreign_keys=ON` de `app/db.py` — sin él, `ondelete="SET NULL"` no se aplicaría (SQLite ignoraría la cláusula igual que ignora las FKs). Un workout histórico con `routine_id=null` sigue siendo válido: la rutina que se siguió ese día ya no importa una vez logueados los sets.
- **`pydantic` es dependencia directa** en `pyproject.toml` (antes solo llegaba transitivamente vía `fastapi`), para no depender de qué versión de pydantic decida arrastrar fastapi.
