# MVP — App de progreso físico

## Objetivo de una línea
Tener rutinas predefinidas asignadas a días de la semana, loguear el entreno del día en pocos clics, y ver semanas después si estás progresando.

## Fuera de alcance (recuérdalo cuando la tentación aparezca)
HealthKit, notificaciones, multiusuario/auth, sync en la nube, RPE/RIR, plantillas compartidas o descargables. Todo esto es v2 (ver [ROADMAP.md](ROADMAP.md)). Si en mitad del MVP te encuentras diseñando esto, para y vuelve al plan.

**Excepción pulida a mitad de Fase 2:** edición simple de un Entreno ya guardado (`PUT /workouts/{id}`, sobrescribe sus sets) se trajo del v2 a petición explícita mientras se probaba en el móvil — sin ella, un error al loguear (peso mal tecleado, serie olvidada) no tenía forma de corregirse. Lo que sigue fuera de alcance es el **historial de cambios** (versión anterior, quién/cuándo editó) — la edición actual sobrescribe sin más, igual que ya hace `PUT /routines/{id}`.

## De qué depende todo lo demás (no negociable)
Las rutinas y el progreso solo sirven si el dato logueado sobrevive. Esto te sale casi gratis con SQLite, así que no hay motivo real para bajarle prioridad frente a lo visual — mantenlo como suelo mínimo en cada fase, aunque el resto del pulido (UI, velocidad) sea donde inviertas el esfuerzo visible.

---

## Modelo de datos mínimo

- **Exercise**: id, nombre, unidad (kg/lb)
- **Routine**: id, nombre (ej. "Push day", "Pierna")
- **RoutineExercise**: id, routine_id, exercise_id, sets objetivo, orden. Sin reps objetivo — al definir una rutina solo se fija cuántas series tocan por ejercicio; peso y reps reales se deciden por completo al loguear en "Hoy" (decisión tomada durante Fase 2, ver su sección de test de avance).
- **ScheduleEntry**: id, día de la semana (0-6), routine_id — qué rutina toca cada día
- **Workout**: id, fecha, routine_id (nullable, por si algún día entrenas algo libre)
- **WorkoutSet**: id, workout_id, exercise_id, peso, reps, orden

**Decisión confirmada:** `ScheduleEntry` mapea por día de la semana fijo (no por ciclo rotativo tipo Push→Pull→Legs→repeat independiente del día). Si te saltas un martes, el próximo martes sigue siendo la rutina que le asignaste, no la que "tocaría" según el ciclo. Es intencional — más simple de ver de un vistazo — no un descuido. Un calendario por ciclo es complejidad de v2, si es que llega.

## Endpoints mínimos

```
GET    /exercises
POST   /exercises

GET    /routines
POST   /routines                 (crea rutina + sus RoutineExercise en una llamada)
GET    /routines/{id}

GET    /schedule                 (mapa día→rutina)
PUT    /schedule/{day}           (asignar/cambiar rutina de un día)

GET    /today?date=YYYY-MM-DD    (día indicado por el cliente → rutina asignada → shape listo para pre-rellenar el log)
POST   /workouts                 (crea workout + sets reales, opcionalmente basado en una rutina)
GET    /workouts                 (lista, ordenada por fecha desc)
GET    /workouts/{id}

GET    /exercises/{id}/progress  (histórico de peso/reps — la razón de ser de la app)
```

**Decisión confirmada:** `/today` recibe la fecha como query param calculada en el cliente (el teléfono), no confía en el reloj del servidor. Coste cero ahora; evita que en Fase 4, si el backend acaba alojado en una zona horaria distinta a la del teléfono, "hoy" se calcule mal justo alrededor de medianoche.

## Pantallas mínimas (mobile)

1. **Rutinas** — crear/editar rutina y sus ejercicios objetivo (solo sets planeados, sin reps objetivo).
2. **Semana** — vista simple de 7 días, asignar una rutina a cada día (o dejarlo vacío = descanso).
3. **Hoy** — pantalla de inicio real: muestra la rutina de hoy pre-rellenada, logueas peso/reps reales contra cada ejercicio en pocos taps. Aquí es donde va la velocidad de logueo que priorizaste.
4. **Historial** — lista de entrenos pasados.
5. **Progreso** — histórico de un ejercicio a lo largo del tiempo.

Nada de tabs elaboradas, onboarding, ni splash animado — pero sí puedes invertir tiempo real en que "Hoy" se sienta bien (lo pediste como prioridad #2), es la pantalla que vas a abrir cada día.

---

## Fases

### Fase 0 — Esqueleto conectado
**Entregable:** backend con los endpoints devolviendo datos falsos/hardcodeados, app Expo pintando datos reales del backend en tu iPhone vía Expo Go.

**Test de avance:**
- [ ] `/docs` de FastAPI muestra todos los endpoints
- [ ] Desde el iPhone (misma Wi-Fi, IP LAN, no localhost) la app pinta datos reales, no mockeados en el frontend
- [ ] Si apagas el backend, la app no crashea, muestra un estado de error visible

### Fase 1 — Rutinas y calendario semanal
**Entregable:** puedes crear una rutina con ejercicios objetivo y asignarla a un día de la semana, todo persistido.

**Decisión confirmada:** persistencia vía SQLAlchemy (no `sqlite3` crudo). Afecta la estructura de `app/services/` — modelos ORM separados de los schemas Pydantic existentes.

**Test de avance:**
- [x] Creas 2+ rutinas distintas desde el móvil, cada una con varios ejercicios objetivo
- [x] Las asignas a días de la semana y, al cerrar y reabrir la app, la asignación sigue ahí
- [x] Reinicias el backend y las rutinas/asignaciones siguen en SQLite (persistencia real, no en memoria)
- [x] Los 24 tests de Fase 0 (o su equivalente adaptado) pasan contra la capa SQLAlchemy, no contra el store en memoria — antes de dar Fase 1 por cerrada y pasar a Fase 2

**Verificado on-device 2026-08-10.** Además de lo planeado, se añadió edición y borrado de rutinas (`PUT`/`DELETE /routines/{id}`) — hueco real encontrado probando en el iPhone, no estaba en el plan original de Fase 1 pero era necesario para poder corregir un error al crear una rutina.

### Fase 2 — Loguear el "Hoy" (el vertical slice real)
**Entregable:** abres la app, ves la rutina de hoy pre-rellenada, logueas peso/reps reales en pocos taps, y queda guardado como Workout.

**Decisión confirmada (durante la propia Fase 2):** `RoutineExercise` pierde `target_reps` — una rutina solo fija cuántas series tocan por ejercicio (`target_sets`), no las reps. En "Hoy" cada ejercicio pre-rellena `target_sets` filas vacías de peso+reps (ajustables con "+ añadir serie"/"Quitar" por si un día haces más o menos series de las planeadas), en vez de pedir reps objetivo por adelantado.

**Test de avance:**
- [x] Un día con rutina asignada: la pantalla "Hoy" te muestra los ejercicios de esa rutina sin que tengas que buscarlos
- [x] Un día sin rutina asignada (descanso): la pantalla lo indica claramente en vez de mostrar algo vacío confuso
- [x] Logueas un entreno completo en menos de 10 taps para una rutina de 4 ejercicios
- [x] El entreno logueado aparece en Historial y sobrevive a reiniciar el backend
- [x] Metes un input inválido a propósito (peso vacío, reps negativas) y la app no crashea

**Verificado on-device 2026-08-10.** Además de lo planeado, durante la propia fase se pulieron varios huecos reales encontrados probando en el iPhone: el formulario de "Hoy" perdía la marca de "ya guardado" al cambiar de pestaña y volver (riesgo de entrenos duplicados), el teclado tapaba el botón de guardar en "Rutinas"/"Hoy"/"Historial" por no tener en cuenta la altura de la tab bar, y se trajo adelantado del roadmap v2 un `PUT /workouts/{id}` para poder corregir un entreno ya guardado (sin historial de cambios — ver "Fuera de alcance" más arriba).

**Pendiente dentro de esta fase (no cerrar Fase 2 sin esto):**
- [x] Añadir a `backend/app/seed.py` los ejercicios reales que el usuario entrena ahora mismo — lista dada 2026-08-10, 19 ejercicios nuevos + "Dominadas" ya existente. Insertados también en la `laystra.db` real sin tocar las rutinas/entrenos ya logueados por el usuario (24 ejercicios en total, 35/35 tests en verde).

**Fase 2 cerrada 2026-08-10.**

### Fase 3 — Progreso
**Entregable:** pantalla de progreso por ejercicio.

**Añadido al plan de esta fase (pedido 2026-08-10):**
- `DELETE /workouts/{id}` + botón "Borrar" por tarjeta en Historial — hace falta para limpiar entrenos de prueba sin tener que tocar la DB a mano. Mismo patrón que `PUT /workouts/{id}` (ya existe), así que es barato.
- "Loguear otro entreno" en Hoy tiene dos problemas de raíz: (1) al pulsarlo, la confirmación del entreno recién guardado desaparece sin más — no queda constancia visible de qué ya se logueó hoy mientras rellenas el segundo; (2) el formulario que aparece está fijo a la rutina asignada de hoy, así que no sirve para el caso real: ya hiciste "Pull" (tu rutina de hoy) y luego, aparte, saliste a correr — quieres añadir eso como un segundo Workout del mismo día, no repetir "Pull". Arreglo: "Loguear otro entreno" debería (a) mantener visible/resumido lo ya guardado en vez de taparlo, y (b) dejar elegir qué loguear a continuación — otra rutina existente, o "entreno libre" (el modelo ya soporta `Workout.routine_id` nulo para esto) con un picker de ejercicios como el de `RoutinesScreen.tsx`. **Ojo:** "running" tal cual lo pusiste como ejemplo no encaja de verdad en `WorkoutSet` (peso/reps) — para loguear cardio en condiciones (distancia/tiempo) hace falta la generalización `Session`/`session_type` ya apuntada en `ROADMAP.md` → "Sección de objetivos". Sin esa generalización, esto solo resuelve poder loguear una segunda sesión de FUERZA (otra rutina o ejercicios sueltos) el mismo día, no un run de verdad.

**Test de avance:**
- [x] Con 3+ entrenos logueados del mismo ejercicio en fechas distintas, la pantalla de progreso muestra la evolución correctamente ordenada
- [x] Un ejercicio sin histórico no rompe la pantalla, muestra estado vacío razonable

**Verificado on-device 2026-08-11.** Durante la revisión previa a cerrar la fase, `reviewer` encontró un bug real: el `useFocusEffect` de `ProgressScreen` capturaba una closure obsoleta y nunca refrescaba el progreso al volver a la pestaña (loguear un entreno en Hoy y volver a Progreso mostraba datos viejos). Arreglado con el mismo patrón de ref que ya usa `TodayScreen`. De paso se añadió una guarda de carrera (descartar respuesta si el ejercicio seleccionado cambió mientras la petición estaba en vuelo) y un desempate por `id` en `GET /exercises/{id}/progress` para que el orden de dos entrenos del mismo día coincida con el de Historial.

**Fase 3 cerrada 2026-08-11.**

### Fase 4 — Fuera de tu ordenador
**Entregable:** build vía EAS instalado en tu iPhone, sin depender de Expo Go ni de tu Mac inexistente. (El plan original hablaba de TestFlight; el cierre real fue vía instalación ad-hoc directa — ver "Progreso" abajo.)

**Decisión confirmada (2026-08-13):** backend self-hosted en el PC del usuario (Windows + Docker Desktop, con migración prevista a una máquina Linux dedicada más adelante) en vez de VPS/PaaS. Primer intento — Caddy + DuckDNS + port-forwarding en el router — no funcionó: el ISP residencial (Digi) usa CGNAT, así que ninguna regla de reenvío de puertos podía funcionar por bien configurada que estuviera (confirmado de forma exhaustiva: firewall del router, rango de IP origen, reinicio del router, un puerto de prueba nuevo seguía cerrado desde dos verificadores externos independientes). Se pivotó a **Cloudflare Tunnel** sobre un dominio propio (`vicrojas.com`, comprado en Namecheap, nameservers apuntando a Cloudflare) — al ser una conexión saliente desde `cloudflared`, evita el problema de CGNAT por completo, sin depender de tener un puerto público alcanzable. Detalle técnico completo en `backend/docs/ARCHITECTURE.md` → "Despliegue (Fase 4)".

**Progreso (2026-08-13):**
- Backend en producción funcionando end-to-end: `https://laystra.vicrojas.com` sirve datos reales (`/health`, `/exercises` verificados), Docker Desktop arranca solo al iniciar sesión y los contenedores tienen `restart: unless-stopped`, así que un reinicio del PC se autorecupera sin intervención manual.
- Proyecto Expo/EAS creado y vinculado (`@vicrojass/laystra`), `eas.json` con perfiles `development`/`preview`/`production` — preview/production apuntan a `https://laystra.vicrojas.com` vía `EXPO_PUBLIC_API_URL`, no a una IP LAN.

**Alta del Apple Developer Program completada 2026-08-16** — más rápido de lo aplazado (~3 días en vez de las ~2 semanas estimadas el 2026-08-13). `eas build --platform ios --profile preview` corrió sin errores e instaló el build directamente en el iPhone físico del usuario vía distribución ad-hoc/interna — verificado contra el backend de producción. **`eas submit`/TestFlight se descarta deliberadamente:** app personal de un solo dispositivo, el install ad-hoc ya cubre la necesidad sin pasar por App Store Connect. Si en el futuro hace falta instalar en más de un dispositivo, retomar TestFlight es barato (la config de `eas.json` ya está lista).

**Test de avance:**
- [x] `eas build --profile preview` completa sin errores
- [x] Instalas el build (ad-hoc, no TestFlight — decisión explícita, ver arriba) y el flujo completo funciona contra un backend accesible desde fuera de tu red local
- [x] No hay URLs de `localhost` ni tu IP local hardcodeadas en el build de producción (`EXPO_PUBLIC_API_URL` del perfil `preview` apunta a `https://laystra.vicrojas.com`)

**Fase 4 cerrada 2026-08-16.**

---

## Test general de "¿voy bien encaminado?"

1. **¿Lo que estoy haciendo ahora mismo está en una de las 5 fases de arriba?** Si no, para.
2. **¿Podría abrir la app hoy, ver mi rutina del día y loguearla con lo que ya tengo?** Si la respuesta lleva siendo "no" más de una semana, el scope se te ha ido de las manos.
3. **¿He tocado Progreso (fase 3) antes de que loguear el "Hoy" (fase 2) esté sólido?** Si sí, retrocede.
4. **¿Estoy invirtiendo tiempo en pulido visual a costa de que el dato se pueda perder?** Dado que la persistencia es casi gratis con SQLite, no debería haber ese dilema real — si lo hay, algo se ha complicado de más.
5. **¿Estoy diseñando algo "por si acaso" (auth, sync, RPE)?** Señal de que te vas de MVP a producto.

Ritmo estimado a 5-10h/semana: Fase 0-1 en la primera semana, Fase 2 (el hito que de verdad importa) en la segunda-tercera semana, Fase 3-4 después sin prisa.
