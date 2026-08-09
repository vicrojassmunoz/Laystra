# MVP — App de progreso físico

## Objetivo de una línea
Tener rutinas predefinidas asignadas a días de la semana, loguear el entreno del día en pocos clics, y ver semanas después si estás progresando.

## Fuera de alcance (recuérdalo cuando la tentación aparezca)
HealthKit, notificaciones, multiusuario/auth, sync en la nube, RPE/RIR, plantillas compartidas o descargables, edición de entrenos pasados con historial de cambios. Todo esto es v2 (ver [ROADMAP.md](ROADMAP.md)). Si en mitad del MVP te encuentras diseñando esto, para y vuelve al plan.

## De qué depende todo lo demás (no negociable)
Las rutinas y el progreso solo sirven si el dato logueado sobrevive. Esto te sale casi gratis con SQLite, así que no hay motivo real para bajarle prioridad frente a lo visual — mantenlo como suelo mínimo en cada fase, aunque el resto del pulido (UI, velocidad) sea donde inviertas el esfuerzo visible.

---

## Modelo de datos mínimo

- **Exercise**: id, nombre, unidad (kg/lb)
- **Routine**: id, nombre (ej. "Push day", "Pierna")
- **RoutineExercise**: id, routine_id, exercise_id, sets objetivo, reps objetivo, orden
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

1. **Rutinas** — crear/editar rutina y sus ejercicios objetivo (sets/reps planeados).
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

**Test de avance:**
- [ ] Creas 2+ rutinas distintas desde el móvil, cada una con varios ejercicios objetivo
- [ ] Las asignas a días de la semana y, al cerrar y reabrir la app, la asignación sigue ahí
- [ ] Reinicias el backend y las rutinas/asignaciones siguen en SQLite (persistencia real, no en memoria)

### Fase 2 — Loguear el "Hoy" (el vertical slice real)
**Entregable:** abres la app, ves la rutina de hoy pre-rellenada, logueas peso/reps reales en pocos taps, y queda guardado como Workout.

**Test de avance:**
- [ ] Un día con rutina asignada: la pantalla "Hoy" te muestra los ejercicios de esa rutina sin que tengas que buscarlos
- [ ] Un día sin rutina asignada (descanso): la pantalla lo indica claramente en vez de mostrar algo vacío confuso
- [ ] Logueas un entreno completo en menos de 10 taps para una rutina de 4 ejercicios
- [ ] El entreno logueado aparece en Historial y sobrevive a reiniciar el backend
- [ ] Metes un input inválido a propósito (peso vacío, reps negativas) y la app no crashea

### Fase 3 — Progreso
**Entregable:** pantalla de progreso por ejercicio.

**Test de avance:**
- [ ] Con 3+ entrenos logueados del mismo ejercicio en fechas distintas, la pantalla de progreso muestra la evolución correctamente ordenada
- [ ] Un ejercicio sin histórico no rompe la pantalla, muestra estado vacío razonable

### Fase 4 — Fuera de tu ordenador
**Entregable:** build vía EAS instalado en tu iPhone por TestFlight, sin depender de Expo Go ni de tu Mac inexistente.

**Nota:** dónde vive el backend en producción (VPS propio vs. PaaS tipo Fly.io/Railway/Render) no se decide ahora — es una decisión de Fase 4, no algo que valga la pena resolver mientras la Fase 0 sigue sin empezar. Cuando llegue el momento: iOS bloquea HTTP plano por defecto (App Transport Security) en builds de TestFlight/producción, así que el host elegido necesita HTTPS de fábrica — tenlo en cuenta al decidir, no lo asumas resuelto por tener un IP pública cualquiera.

**Test de avance:**
- [ ] `eas build --profile preview` completa sin errores
- [ ] Instalas el build vía TestFlight y el flujo completo funciona contra un backend accesible desde fuera de tu red local
- [ ] No hay URLs de `localhost` ni tu IP local hardcodeadas en el build de producción

---

## Test general de "¿voy bien encaminado?"

1. **¿Lo que estoy haciendo ahora mismo está en una de las 5 fases de arriba?** Si no, para.
2. **¿Podría abrir la app hoy, ver mi rutina del día y loguearla con lo que ya tengo?** Si la respuesta lleva siendo "no" más de una semana, el scope se te ha ido de las manos.
3. **¿He tocado Progreso (fase 3) antes de que loguear el "Hoy" (fase 2) esté sólido?** Si sí, retrocede.
4. **¿Estoy invirtiendo tiempo en pulido visual a costa de que el dato se pueda perder?** Dado que la persistencia es casi gratis con SQLite, no debería haber ese dilema real — si lo hay, algo se ha complicado de más.
5. **¿Estoy diseñando algo "por si acaso" (auth, sync, RPE)?** Señal de que te vas de MVP a producto.

Ritmo estimado a 5-10h/semana: Fase 0-1 en la primera semana, Fase 2 (el hito que de verdad importa) en la segunda-tercera semana, Fase 3-4 después sin prisa.
