# Backend architecture

FastAPI app for Laystra. Full MVP endpoint surface, backed by real SQLite persistence via SQLAlchemy (Fase 1). Fase 2 quitó `target_reps` de `RoutineExercise`: las rutinas ya solo fijan sets objetivo, no reps.

## Estado (dónde vive el dato)

El dato vive en SQLite, fichero `backend/laystra.db` (sibling de `pyproject.toml`, definido en `app/db.py` como `DB_PATH`). El engine y `SessionLocal` (sessionmaker) se declaran también en `app/db.py`, junto con `Base` (`DeclarativeBase`) y dos funciones:

- `init_db()` — crea las tablas que falten vía `Base.metadata.create_all`. **No hay Alembic/migraciones todavía** — pendiente para cuando haga falta versionar el esquema.
- `get_db()` — generador que abre/cierra una `Session` por request, inyectado en los routers vía `Depends(get_db)`.
- Un listener `@event.listens_for(engine, "connect")` ejecuta `PRAGMA foreign_keys=ON` en cada conexión nueva — SQLite ignora las FKs por defecto si no se activan explícitamente por conexión, así que sin esto los `ForeignKey` de `models.py` no se validaban de verdad a nivel de motor.

`app/main.py` usa un `lifespan` (`@asynccontextmanager`) que llama `init_db()` y luego `seed_if_empty()` (`app/seed.py`) al arrancar, antes de aceptar tráfico. `seed_if_empty(db)` solo corre si la tabla `exercises` está vacía — seguro de llamar en cada arranque sin duplicar filas. Siembra 24 `Exercise` en total: los 5 originales de ejemplo (Fase 0/1: Press banca, Sentadilla, Peso muerto, Dominadas, Remo con barra) más 19 añadidos el 2026-08-10 que son los ejercicios reales que el usuario entrena hoy (Remo mancuerna unilateral, Flexiones, Pullover, Curl martillo, etc. — ver `app/seed.py` para la lista completa). Las rutinas de ejemplo ("Push day"/"Pierna") y el schedule (lunes→Push, miércoles→Pierna) solo usan los 5 originales; los 19 nuevos existen como `Exercise` sueltos, sin rutina que los use todavía, para que el usuario los tenga disponibles al crear/editar rutinas desde el móvil. Esta siembra solo corre en una BD nueva; contra la `laystra.db` real ya poblada (con rutinas/entrenos del usuario), los mismos 19 ejercicios se insertaron una vez con un script puntual (no forma parte del repo ni de `seed_if_empty`, ya se ejecutó y se descartó) para no perder datos existentes.

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
- `GET /today?date=YYYY-MM-DD` → **`date` es un query param obligatorio**, no hay default ni se usa el reloj del servidor. Decisión deliberada: el cliente (el móvil) calcula "hoy" en su propia zona horaria y se lo pasa al backend; evita que un backend alojado en otra zona horaria (Fase 4) calcule mal el día alrededor de medianoche. Devuelve `day_of_week` (`date.weekday()`: lunes=0), la rutina asignada ese día (o `null` si es descanso) y su lista de ejercicios ya resueltos (`TodayExercise`: nombre, unidad, `target_sets`, `order`) listos para pre-rellenar el log. **No incluye reps objetivo** — desde Fase 2 las reps ya no se definen al crear la rutina, solo se registran al loguear el entreno real (`WorkoutSet.reps`).

### `app/routers/workouts.py` (prefix `/workouts`)
- `GET /workouts` → lista ordenada por fecha descendente
- `POST /workouts` → crea workout + sus `WorkoutSet` (201). 404 si `routine_id` o algún `exercise_id` de los sets no existen.
- `GET /workouts/{id}` → 404 si no existe
- `PUT /workouts/{id}` → edición completa de un workout ya guardado, mismo patrón que `PUT /routines/{id}`: `WorkoutCreate` (mismo body que `POST /workouts`) reemplaza `date`, `routine_id` y toda la lista de `WorkoutSet` (se reasigna `workout.sets`, cascade `delete-orphan` borra las filas viejas). 404 si el workout no existe, si `routine_id` viene no-nulo y no existe, o si algún `exercise_id` de `sets` no existe. Sin historial de cambios — sobrescritura simple, pulido a mitad de Fase 2 a petición del usuario (fuera del alcance original del MVP).
- `DELETE /workouts/{id}` → 204, borra el workout. 404 si no existe. Mismo patrón que `DELETE /routines/{id}`: el cascade `delete-orphan` de `Workout.sets` borra también los `WorkoutSet` asociados. Añadido en Fase 3 a petición del usuario (ver `docs/MVP.md`, sección "Fase 3 — Progreso").

## Modelo de datos

### Tablas ORM (`app/models.py`, SQLAlchemy 2.0, `Mapped`/`mapped_column`)

- `Exercise` (`exercises`): `id`, `name`, `unit` (default `"kg"`). En el schema Pydantic (no en la tabla ORM, que solo tiene `str`) `unit` es `Literal["kg", "lb"]` — cualquier otro valor da 422 al crear un ejercicio.
- `Routine` (`routines`): `id`, `name`; `exercises: list["RoutineExercise"]` (relación 1:N, cascade `all, delete-orphan`, ordenada por `RoutineExercise.order`)
- `RoutineExercise` (`routine_exercises`): `id`, `routine_id` (FK), `exercise_id` (FK), `target_sets`, `order` — **sin `target_reps`** desde Fase 2 (ver "Decisiones no obvias"): las reps objetivo dejaron de definirse al crear la rutina.
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

## Despliegue (Fase 4)

El backend corre en producción vía Docker Compose (`backend/docker-compose.yml`), self-hosted en un PC del usuario (Windows + Docker Desktop de momento, con migración prevista a una máquina Linux dedicada más adelante — por eso el setup vive en contenedores en vez de scripts atados a una máquina concreta). Dos servicios:

- `backend` — construido desde `backend/Dockerfile` (`python:3.12-slim` + `uv`), sin puertos publicados al host: solo alcanzable dentro de la red interna de Compose. `laystra.db` vive en un volumen nombrado (`laystra-db:/data`), montado vía `LAYSTRA_DB_PATH=/data/laystra.db` — `app/db.py` lee esa variable de entorno si existe y si no cae al path por defecto (sibling de `pyproject.toml`), así que `uv run` en local no cambia de comportamiento.
- `cloudflared` — cliente de Cloudflare Tunnel, se conecta de forma saliente al edge de Cloudflare y expone `https://laystra.vicrojas.com` (dominio propio del usuario, gestionado en Cloudflare) hacia `http://backend:8000` dentro de la red de Compose. TLS lo termina Cloudflare, no hace falta certificado propio.

**Por qué túnel y no reverse-proxy + port-forwarding (Caddy + DuckDNS, primer intento):** el ISP residencial del usuario (Digi, España) resulta usar CGNAT — la IP pública que ve el router no es realmente enrutable desde fuera, así que ninguna regla de port-forwarding en el router podía funcionar por mucho que se configurase bien (se comprobó exhaustivamente: firewall del router, reglas de reenvío, rango de IP origen, reinicio del router — un puerto de prueba nuevo sin usar seguía apareciendo cerrado desde dos verificadores externos independientes). Un túnel saliente (Cloudflare Tunnel) evita el problema por completo: no depende de que haya un puerto público alcanzable en el router. `cloudflared` es la única pieza expuesta a internet; ya no hace falta abrir puertos en el router ni en el Firewall de Windows para 80/443.

Variable real (`CLOUDFLARE_TUNNEL_TOKEN`, del dashboard de Cloudflare Zero Trust → Networks → Tunnels) va en `backend/.env` (gitignored vía el patrón `.env`/`.env.*` del `.gitignore` raíz); `backend/.env.example` documenta la clave esperada.

## Decisiones no obvias

- **Validación en el borde**: `Field(gt=0)` / `Field(ge=0)` en los schemas rechaza reps negativas, sets/reps en cero, etc., directamente en la capa de Pydantic — antes de que la lógica de negocio los vea. Un valor inválido devuelve 422 automáticamente.
- **CORS abierto** (`main.py`): `allow_origins=["*"]`. Deliberado — app personal de un solo usuario, sin auth. Revisado en Fase 4 (hosting público) y mantenido sin cambios: CORS es un mecanismo que aplican los navegadores, no el `fetch` de React Native, así que exponer el backend públicamente no lo hace más relevante — solo importaría si alguna vez se sirve un cliente web contra esta API.
- **IDs autoincrementales de SQLite**: cada tabla usa el `id` autoincremental que da SQLite (`primary_key=True` en la columna), no hay UUIDs. En tests se reinician en cada test porque el fixture `autouse` recrea el esquema (`drop_all`/`create_all`) sobre el engine en memoria; en producción son estables mientras exista `laystra.db`.
- **Sin migraciones (Alembic)**: `init_db()` solo hace `create_all`, que crea tablas que no existan pero no altera las existentes. Cualquier cambio de esquema sobre un `laystra.db` ya poblado requiere migración manual (borrar el fichero en dev, o Alembic cuando llegue). Pendiente para cuando el esquema necesite versionarse de verdad.
- **FKs de SQLite activadas por conexión**: SQLite no aplica `FOREIGN KEY` por defecto salvo que cada conexión ejecute `PRAGMA foreign_keys=ON` (ver `app/db.py`). Sin el listener de conexión, las FKs declaradas en `models.py` existían solo como documentación del esquema y no bloqueaban inserts/deletes inválidos.
- **Borrar una rutina no bloquea ni arrastra en cascada**: `ScheduleEntry.routine_id` y `Workout.routine_id` usan `ondelete="SET NULL"` (`app/models.py`). Al hacer `DELETE /routines/{id}`, SQLite pone a `null` el `routine_id` de cualquier día de la semana o workout histórico que apuntara a esa rutina, en vez de lanzar un error de integridad o borrar esas filas. Esto depende del `PRAGMA foreign_keys=ON` de `app/db.py` — sin él, `ondelete="SET NULL"` no se aplicaría (SQLite ignoraría la cláusula igual que ignora las FKs). Un workout histórico con `routine_id=null` sigue siendo válido: la rutina que se siguió ese día ya no importa una vez logueados los sets.
- **`pydantic` es dependencia directa** en `pyproject.toml` (antes solo llegaba transitivamente vía `fastapi`), para no depender de qué versión de pydantic decida arrastrar fastapi.
- **`RoutineExercise` sin `target_reps` (Fase 2)**: crear/editar una rutina (`POST`/`PUT /routines`) solo fija `target_sets` y `order` por ejercicio, no un número de reps objetivo. Las reps reales solo existen a nivel de `WorkoutSet.reps`, capturadas al loguear el entreno del día — reflejan lo que de verdad se hizo esa sesión, no un objetivo fijado de antemano en la rutina. Consecuencia directa: `TodayExercise` (la lista que pre-rellena la pantalla "Hoy") tampoco trae reps objetivo, solo `target_sets`.
