# Roadmap de ideas futuras — App de progreso físico

No tocan el MVP actual (rutinas + calendario + log + progreso, ver [MVP.md](MVP.md)). Esto es backlog para después, organizado por cercanía real, no por orden en que las mencionaste.

---

## v1 - evolución a app más profesional

### Menú Home
Pantalla principal con 
- Pequeño resumen de la semana arriba, marcando días pasados con distinción de si se ha entrenado o no. Acceso directo a `Semana`.
- Debajo acceso directo a `Objetivos` - pantalla por hacer - ahora mismo dummy
- Mitad bloque medio de la pantalla acceso directo a `User` - pantalla por hacer, ahora mismo dummy
- Otra mitad bloque medio acceso directo a `Análisis` - pantalla por hacer, ahora mismo dummy
- Justo debajo, mitad para acceso directo a `Rutinas`
- En la otra mitad acceso directo a `historial`

## v2 — extensiones naturales del MVP, coste bajo/medio

### ~~Buscador y agrupación por grupo muscular en el picker de ejercicios~~ — hecho (2026-08-14)
Implementado, pero con más alcance del planeado originalmente aquí: en vez de un campo plano único, `Exercise` terminó con `muscle_group_primary` (obligatorio, catálogo cerrado de 8: Pecho/Espalda/Hombros/Bíceps/Tríceps/Piernas/Core/Cardio-Otros) + una tabla hija `ExerciseSecondaryMuscle` (0 a N secundarios) — el usuario pidió explícitamente ser "clínico" con los antagonistas/sinergistas de cada ejercicio real. Esto **adelanta parte de "Modelo de músculos" de v3** más abajo: ya no hace falta la tabla `Muscle`/`ExerciseMuscle` genérica para tener múltiples músculos por ejercicio con rol (principal/secundario) — lo que sigue faltando de v3 es un asset visual (silueta tapeable) y las categorías siguen siendo un catálogo cerrado de 8, no músculos anatómicos libres.

Picker con buscador (ignora acentos) + agrupación por sección con orden fijo, en `RoutinesScreen.tsx` y `TodayScreen.tsx` (entreno libre, incluidos los pickers de super-serie). **Pendiente, aparcado explícitamente (2026-08-14):** el tercer picker de ejercicios, en `ProgressScreen.tsx` (elegir de qué ejercicio ver el progreso), se quedó sin el mismo tratamiento — el componente compartido `ExercisePickerList.tsx` ya existe, así que aplicarlo ahí es una extensión trivial cuando se retome.

### Registro de condición física (peso, % grasa)
Entidad nueva y sencilla: `BodyMetric` (fecha, peso, %grasa opcional). Sin dependencias raras, es una pantalla + un endpoint más. De las ideas de la lista, la más barata de todas — podría entrar casi en el MVP si quisieras.

### Colapsar/expandir ejercicios en "Hoy" tras guardar
Una vez el entreno queda guardado ("Entreno guardado ✓"), cada tarjeta de ejercicio podría colapsarse a solo el nombre en vez de seguir mostrando todas las filas de series ya guardadas — y poder expandirla nuevamente tocándola para revisar el detalle, sin tener que ir a Historial. Puramente UI: estado local por tarjeta (`expandido: boolean`), sin tocar backend ni el modelo de datos. Encaja bien como pulido de la pantalla "Hoy" (la prioridad #2 que ya se marcó en `MVP.md`), no es MVP-crítico así que queda para después.

### Crear ejercicios nuevos desde la propia app, con selector kg/lb
Ahora mismo la única forma de añadir un `Exercise` es que un dev edite `backend/app/seed.py` (o inserte a mano en la DB) — no hay UI en el móvil para ello, aunque `POST /exercises` ya existe en el backend. El propio schema (`backend/app/schemas/exercise.py`) ya tiene `unit: Literal["kg", "lb"]`, así que el backend no necesita cambios; solo falta:
- Un "+ Nuevo ejercicio" dentro del picker de ejercicios que ya usa `RoutinesScreen.tsx` (modal), en vez de solo listar los existentes.
- Un formulario mínimo: nombre + selector kg/lb (**kg por defecto**).

Barato — reutiliza UI ya existente, no toca el modelo de datos.

### Añadir un ejercicio nuevo al editar un Entreno pasado
La edición de un Workout ya guardado (Historial → "Editar", Fase 2) solo deja tocar/añadir/quitar series de los ejercicios que ese entreno ya tenía — no añadir uno que no se logueó ese día (por ejemplo, si te olvidaste de apuntar una serie de un ejercicio entero). Se dejó fuera a propósito para no meter un picker de ejercicios dentro del formulario de edición en la primera pasada. Barato de añadir después: reutilizar el mismo modal de selección de ejercicio que ya usa `RoutinesScreen.tsx`.

### Exportar el registro de entrenos a CSV
Barata: un endpoint (`GET /workouts/export` o similar) que recorra `Workout`/`WorkoutSet` y devuelva CSV en vez de JSON — no hace falta librería nueva en el backend, es formatear texto. En el móvil, `expo-sharing` + `expo-file-system` (ya disponibles en Expo Go, no hace falta salir de él ni pasar por `eas-agent`) para guardar/compartir el archivo generado. Encaja bien justo después del MVP, no depende de nada de lo demás en este documento.

### Sección de objetivos (3, o los que sean) y planificación semanal en base a ellos
Esto es más gordo de lo que parece porque **obliga a generalizar el modelo actual**. Ahora mismo `Routine`/`Workout` están pensados para musculación (sets/reps/peso). Si quieres meter correr como un objetivo más, necesitas algo tipo:

- `Goal` (nombre, tipo: fuerza/cardio/otro, métrica objetivo)
- Generalizar `Workout` a algo tipo `Session` con un `session_type` (strength/cardio/...) y que cada tipo tenga sus propios campos (fuerza: sets/reps/peso; cardio: distancia/tiempo/ritmo)

No es difícil, pero es una decisión de arquitectura que conviene tomar ANTES de tener 50 entrenos de fuerza logueados con un modelo que luego hay que migrar. Si esto te importa de verdad a medio plazo, dímelo ahora y lo diseñamos genérico desde ya en el MVP, aunque solo uses el tipo "fuerza" al principio.

**Decisión actual: no generalizar todavía.** Seguir con `Workout`/`WorkoutSet` solo-fuerza hasta que cardio sea un plan real a corto plazo, no "por si acaso". La migración de `Workout` a `Session` con tipos es un rename + split acotado, no una reescritura — no hay coste real en esperar.

**Caso real que la reengancha (2026-08-10):** surgió pidiendo mejorar "Loguear otro entreno" en Hoy — el caso concreto es "ya hice Pull hoy (mi rutina asignada) y luego salí a correr, quiero añadir el run como segunda sesión del mismo día" (ver `MVP.md` → Fase 3). Confirma que el hueco es real, no hipotético, pero no cambia la decisión de arriba: sin esta generalización, ese caso concreto solo se resuelve a medias (loguear una segunda sesión de fuerza sí, un run con distancia/tiempo no).

### Asistencia en directo durante la sesión
Lo trocearía así por coste:

- **Timer de sesión** (cuánto llevas entrenando) — trivial, estado local en la app.
- **Temporizador de descanso con alarma** — aquí ojo: notificaciones locales fiables en iOS con la app en background normalmente requieren salir de Expo Go y usar un **development build** (esto es del `eas-agent`, no del `frontend-coder` a pelo). Con la app en primer plano es más sencillo (un simple countdown), pero si quieres que te avise con el móvil bloqueado, ya estás fuera de Expo Go.
- **Info del siguiente ejercicio** — gratis, es solo UI leyendo la rutina de hoy.
- **Frases/tips rotando** — trivial: un array de textos en el backend o incluso hardcodeado en el cliente, sin necesidad de IA para esto.
- **Apuntar peso rápido en el descanso** — es la misma pantalla de log de hoy, solo que accesible desde la vista de "descanso". Diseño de UX más que problema técnico.

### Sensaciones en el registro
Un campo `notes` (texto libre) en `WorkoutSet` o `Workout`. Barato. La parte "guapa" vendría después, si quieres que la IA lea esas notas.

---

## v3 — con más peso, requieren diseño propio

### ~~Modelo de músculos~~ — parcialmente hecho (2026-08-14), ver nota arriba
La parte de datos ya existe: `Exercise.muscle_group_primary` + tabla hija `ExerciseSecondaryMuscle` cubren "un ejercicio trabaja varios músculos con distinto rol (principal/secundario)", que era el objetivo de esta sección. Diferencia con lo que se planteó aquí originalmente: el catálogo es cerrado (8 categorías amplias, no un `Muscle` de nombre libre tipo "dorsal"/"cuádriceps") — así que "ver tu progreso en un músculo" ya es una query real (`Exercise` con ese `muscle_group_primary` o con ese valor en sus secundarios, principal antes que secundario), pero a la granularidad de esas 8 categorías, no de músculos anatómicos individuales. Si en algún momento hace falta esa granularidad fina (p. ej. separar cuádriceps de glúteo dentro de "Piernas"), habría que decidir entonces si se amplía el catálogo cerrado o se pasa a un `Muscle` de verdad con nombre libre — no es necesario solo para la silueta tapeable de abajo, que puede mapear regiones del SVG a las 8 categorías actuales.

### Home con silueta de cuerpo tapeable por grupo muscular
Bonita idea, viable en Expo/RN con `react-native-svg` (un SVG con regiones tapeables por grupo muscular). Dos implicaciones:
1. Necesitas un asset SVG con las regiones bien delimitadas — o lo encargas, o lo generas con ayuda de IA de imagen y lo recortas tú.
2. Ya no depende de construir el modelo de músculos desde cero (ver nota arriba, ya existe) — solo de mapear cada región del SVG a una de las 8 categorías de `muscle_group_primary`/`muscle_group_secondary` ya existentes.

Es la típica feature que vende mucho visualmente y cuesta relativamente poco una vez tienes el modelo de datos de músculos.

### Análisis en directo durante la sesión
Lo dijiste tú mismo: complicadete. Analizar en tiempo real (no post-sesión) implica lógica reactiva mientras logueas cada set — factible pero es la feature más ambiciosa de todas las "en directo". Yo la dejaría para cuando el resto del flujo de sesión (timer, descansos, log rápido) ya esté sólido y usado de verdad, no antes.

### Modo "split"/balance de entrenamiento, desacoplado del calendario
Idea: en vez de (o además de) depender de que el calendario semanal esté bien rellenado día a día, defines un objetivo de reparto — p. ej. "push/pull/legs" o cualquier otro split — y la app te dice qué te toca según lo que **de verdad** llevas entrenado, no según qué día de la semana es. Si te saltaste el calendario tres días, la app no debería quedarse callada ni insistir en el día "correcto" según el horario — debería decirte "llevas 9 días sin entrenar legs, eso es lo que toca hoy".

Piezas necesarias:
- El modelo de músculos (`Muscle`/`ExerciseMuscle`) descrito arriba — misma dependencia que la silueta tapeable, así que tiene sentido hacer ambas a la vez si se ataca esto. El split razonaría sobre `Muscle` (o un agrupador de músculos tipo "categoría de split") en vez de sobre `Exercise` directamente.
- Una definición de "split" del usuario: lista de categorías + frecuencia objetivo (ej. "legs cada 3-4 días"). No hace falta el `Goal` genérico de la sección de arriba — esto puede ser una tabla pequeña y propia, más barata que generalizar todo el modelo a `Session`.
- Una query de agregación sobre `Workout`/`WorkoutSet` recientes que calcule, por categoría, cuándo fue la última vez que se entrenó — y de ahí derivar qué está "atrasado".
- En "Hoy" (o en una pantalla nueva), mostrar ese desfase en vez de (o además de) lo que dice el calendario — algo tipo "según el calendario toca X, pero llevas más tiempo sin entrenar Y".

Depende del modelo de músculos de arriba, así que en la práctica va después de eso. El resto (tabla de split + cálculo de desfase) es lógica de negocio contenida, no un cambio de arquitectura.

**Extensión: meter categorías que no son fuerza (running, yoga, lo que sea) en el mismo split.** La idea original era solo push/pull/legs (fuerza), pero tiene sentido que el split sea "legs, pull, push, running" y que la app te diga "te toca running, es lo que menos has hecho" igual que con las de fuerza. Esto sí que reengancha con la decisión que se dejó pendiente en "Sección de objetivos" más arriba, porque `Workout`/`WorkoutSet` solo entienden fuerza (sets/reps/peso) — un run no se puede loguear ahí tal cual. Dos caminos, de menor a mayor coste:
- **Barato:** un log de actividad mínimo y aparte (fecha + categoría, sin sets/reps/peso — ni siquiera duración si no te importa) solo para que cuente en el cálculo de desfase del split. No sustituye nada, es un registro paralelo.
- **Completo:** tirar ya de la generalización `Session`/`session_type` de la sección de objetivos (fuerza vs. cardio vs. otro con campos propios cada uno), y que el split lea de ahí directamente.

Si el split con actividades no-fuerza te importa de verdad, probablemente valga la pena saltar directo a la opción completa en vez de montar el log barato y tener que migrarlo después — es el mismo dilema que ya se señaló arriba con `Goal`/`Session`: mejor decidir antes de tener datos logueados con el modelo barato.

### Modos visuales seleccionables: fitness (clásico), videojuego, minimalista
Idea de visión, no de arquitectura — tres pieles distintas para la misma app, elegibles por el usuario (preferencia local en el móvil, no hace falta backend para esto):

- **Fitness (clásico):** lo que ya existe — funcional, sin adornos, es la base sobre la que se montan las otras dos.
- **Videojuego:** gamificado — barras de progreso hacia un objetivo (ej. volumen semanal, racha de días entrenados), quizá niveles/badges. Esta es la piel que más "pide prestado": una barra de progreso necesita algo cuantificable contra lo que barrear, así que en la práctica depende de que exista algún concepto de objetivo/frecuencia ya sea el `Goal` de "Sección de objetivos" más arriba o el cálculo de desfase de "Modo split/balance" — no hay progreso que enseñar sin eso.
- **Minimalista:** la opuesta — recorta todo lo no esencial, probablemente parte de ocultar/simplificar en vez de añadir.

Coste real: es una feature de superficie grande (toca literalmente cada pantalla, no un módulo aislado) aunque técnicamente sea "solo" un sistema de theming/context de React + sets de estilos alternativos por pantalla — nada que obligue a salir de Expo Go. La piel de videojuego es la única que no es puro estilo, porque necesita datos de progreso/objetivos que hoy no existen. Candidata clara para cuando el resto del MVP + v2 esté ya sólido y usado de verdad, no antes — es pulido, no la razón de ser de la app.

---

## Algún día / integraciones grandes

### IA para analizar el registro y ajustar/planificar
Esto es un endpoint de backend que le pasa tu histórico a un LLM (podrías usar la API de Claude, ya que curras con IA) y te devuelve sugerencias. Técnicamente no es difícil una vez tienes datos limpios y consistentes — la dificultad real es tener suficiente histórico fiable como para que el análisis diga algo útil y no genérico. Por eso depende 100% de que el MVP y v2 estén sólidos primero: sin datos buenos, la IA no tiene nada que analizar.

### Integración con Strava
Ya tienes un proyecto propio contra la API de Strava, así que la parte técnica te suena. Para esta app implica OAuth con Strava, guardar tokens, y un job de sync (webhook o polling) — es infraestructura real, no una tarde de curro.

### Integración con Salud (Apple Health / HealthKit)
Como ya sabes, en Expo esto requiere un config plugin y development build sí o sí — no hay forma de tocar HealthKit desde Expo Go. Es candidata clara para cuando el `eas-agent` ya lleve tiempo rodado con builds nativos.

---

## Orden sugerido si algún día atacas esto en serio

1. ~~Buscador y agrupación por grupo muscular en el picker de ejercicios~~ — hecho (2026-08-14), incluida la parte de datos del "Modelo de músculos" de v3 (ver notas arriba). Queda suelto: aplicar el mismo picker a `ProgressScreen.tsx`.
2. `BodyMetric` (peso/%grasa) — barato, entra casi en cualquier momento.
3. Generalizar el modelo a `Goal`/`Session` con tipos — SOLO si de verdad vas a meter cardio pronto. Si no, no lo generalices "por si acaso".
4. Asistencia en directo: timer de sesión + info del siguiente ejercicio + frases (sin notificaciones aún).
5. Temporizador de descanso con alarma real → primer salto a development build vía `eas-agent`.
6. Sensaciones/notas.
7. Home con silueta tapeable — ya no necesita construir el modelo de músculos desde cero (hecho en el punto 1), solo el asset SVG y el mapeo de regiones a las 8 categorías existentes.
8. Modo split/balance desacoplado del calendario — misma base de datos que el punto anterior, tiene sentido hacerlo junto a él.
9. Análisis con IA — solo cuando ya tengas semanas/meses de datos reales logueados.
10. Strava / HealthKit — proyectos aparte en sí mismos, no "una feature más".
