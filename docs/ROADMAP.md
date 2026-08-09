# Roadmap de ideas futuras — App de progreso físico

No tocan el MVP actual (rutinas + calendario + log + progreso, ver [MVP.md](MVP.md)). Esto es backlog para después, organizado por cercanía real, no por orden en que las mencionaste.

---

## v2 — extensiones naturales del MVP, coste bajo/medio

### Registro de condición física (peso, % grasa)
Entidad nueva y sencilla: `BodyMetric` (fecha, peso, %grasa opcional). Sin dependencias raras, es una pantalla + un endpoint más. De las ideas de la lista, la más barata de todas — podría entrar casi en el MVP si quisieras.

### Sección de objetivos (3, o los que sean) y planificación semanal en base a ellos
Esto es más gordo de lo que parece porque **obliga a generalizar el modelo actual**. Ahora mismo `Routine`/`Workout` están pensados para musculación (sets/reps/peso). Si quieres meter correr como un objetivo más, necesitas algo tipo:

- `Goal` (nombre, tipo: fuerza/cardio/otro, métrica objetivo)
- Generalizar `Workout` a algo tipo `Session` con un `session_type` (strength/cardio/...) y que cada tipo tenga sus propios campos (fuerza: sets/reps/peso; cardio: distancia/tiempo/ritmo)

No es difícil, pero es una decisión de arquitectura que conviene tomar ANTES de tener 50 entrenos de fuerza logueados con un modelo que luego hay que migrar. Si esto te importa de verdad a medio plazo, dímelo ahora y lo diseñamos genérico desde ya en el MVP, aunque solo uses el tipo "fuerza" al principio.

**Decisión actual: no generalizar todavía.** Seguir con `Workout`/`WorkoutSet` solo-fuerza hasta que cardio sea un plan real a corto plazo, no "por si acaso". La migración de `Workout` a `Session` con tipos es un rename + split acotado, no una reescritura — no hay coste real en esperar.

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

### Home con silueta de cuerpo tapeable por grupo muscular
Bonita idea, viable en Expo/RN con `react-native-svg` (un SVG con regiones tapeables por grupo muscular). Dos implicaciones:
1. Necesitas un asset SVG con las regiones bien delimitadas — o lo encargas, o lo generas con ayuda de IA de imagen y lo recortas tú.
2. `Exercise` necesita un campo `muscle_group` que ahora mismo no tiene, para poder filtrar el progreso por la zona que tapeas.

Es la típica feature que vende mucho visualmente y cuesta relativamente poco una vez tienes el modelo de datos con `muscle_group`.

### Análisis en directo durante la sesión
Lo dijiste tú mismo: complicadete. Analizar en tiempo real (no post-sesión) implica lógica reactiva mientras logueas cada set — factible pero es la feature más ambiciosa de todas las "en directo". Yo la dejaría para cuando el resto del flujo de sesión (timer, descansos, log rápido) ya esté sólido y usado de verdad, no antes.

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

1. `BodyMetric` (peso/%grasa) — barato, entra casi en cualquier momento.
2. Generalizar el modelo a `Goal`/`Session` con tipos — SOLO si de verdad vas a meter cardio pronto. Si no, no lo generalices "por si acaso".
3. Asistencia en directo: timer de sesión + info del siguiente ejercicio + frases (sin notificaciones aún).
4. Temporizador de descanso con alarma real → primer salto a development build vía `eas-agent`.
5. Sensaciones/notas.
6. Home con silueta tapeable (necesita `muscle_group` en `Exercise`, mételo entonces, no antes).
7. Análisis con IA — solo cuando ya tengas semanas/meses de datos reales logueados.
8. Strava / HealthKit — proyectos aparte en sí mismos, no "una feature más".
