# Roadmap de ideas futuras — App de progreso físico

No tocan el MVP actual (rutinas + calendario + log + progreso, ver [MVP.md](MVP.md)). **No implementar nada de aquí a menos que se pida explícitamente.**

Entregado: [CHANGELOG.md](CHANGELOG.md). Spec de la última tanda cerrada: [V2.md](V2.md).

**Leyenda de columnas:** *Capa* = backend / mobile / ambos. *Expo Go* = si funciona sin development build.

---

## Próxima tanda sugerida

No hay tanda cohesiva fijada. Siguiente natural: **#8** (alarma de descanso real, primer salto a EAS): desbloquea #17 (HealthKit) y con él el contador de pasos completo (#19).

---

## Backlog priorizado

### Ahora — coste barato

| # | Ítem | Capa | Expo Go | Depende de | Hecho cuando | Descripción |
|---|------|------|---------|------------|--------------|-------------|

### Después — coste medio

| # | Ítem | Capa | Expo Go | Depende de | Hecho cuando | Descripción |
|---|------|------|---------|------------|--------------|-------------|
| 8 | Temporizador de descanso con alarma real | mobile | **no** (EAS) | — | Alarma suena con app en background | Primer salto fuera de Expo Go (`eas-agent`). Notificaciones locales fiables. |
| 9 | Home con silueta de cuerpo tapeable | mobile | sí | — | Tocar región del SVG filtra/navega por grupo muscular | `react-native-svg` + asset con regiones mapeadas a las 8 categorías de `muscle_group_primary`. |
| 19 | Contador de pasos | ambos | MVP sí / completo **no** (EAS) | #17 (versión completa) | Tile en Home con pasos de hoy, objetivo diario e histórico semanal | **MVP:** `expo-sensors` `Pedometer` (Expo Go; en iOS ~7 días de historial, solo iPhone, sin Watch). **Completo:** leer pasos de HealthKit (#17), que ya agrega iPhone + Watch + otras apps; pide permiso una vez, no hay que pasar datos a mano. Requiere build EAS. Backend: resumen diario de pasos. Decisión pendiente: arrancar con Pedometer o saltar a HealthKit. |

### Algún día — coste grande

| # | Ítem | Capa | Expo Go | Depende de | Hecho cuando | Descripción |
|---|------|------|---------|------------|--------------|-------------|
| 11 | Tipos de sesión (fuerza / cardio / otro) | ambos | — | — | Modelo que soporte cardio (distancia/tiempo) sin romper fuerza | **`Goal` manual ya existe (v1)** — esto es otra cosa: generalizar `Workout`/`Session` con `session_type` y campos por tipo. **Decisión vigente: no hacerlo** hasta que cardio sea un plan real, no "por si acaso". |
| 12 | Split/balance desacoplado del calendario | ambos | sí | — | Usuario define split propio; app prioriza por desfase muscular | Usa datos de "días sin entrenar" (ya en Análisis, v1). Reengancha con #11 si hay categorías no-fuerza. |
| 13 | Análisis en directo durante la sesión | mobile | sí* | #8 (#7 ya hecho) | Sugerencias reactivas al loguear cada set | Lógica en tiempo real, no post-sesión. *Alarma en background requiere #8 (EAS). Solo cuando #7+#8 estén maduros en uso real. |
| 14 | Modos visuales (fitness / videojuego / minimalista) | mobile | sí | #11 o #12 | Tres pieles, preferencia local | Theming en cada pantalla. Pulido, no core. |
| 15 | IA para analizar registro y planificar | ambos | — | histórico + #6 | Endpoint LLM con sugerencias útiles | Dificultad real = tener datos suficientes. `notes` (#6) alimentan esto. |
| 16 | Integración Strava | ambos | — | — | OAuth + sync de actividades | Infraestructura OAuth, tokens, jobs. |
| 17 | Apple Health / HealthKit | mobile | **no** (EAS) | #8 | Lectura/escritura de métricas acordadas | Config plugin + development build. |

---

## Ítems retirados del backlog

PR por volumen (**#1**), `notes` (**#6**), asistencia en sesión (**#7**) y registro de agua (**#18**) están en [CHANGELOG.md](CHANGELOG.md) → entrada **2026-11-01**.

Las unidades de peso por ejercicio (el **#10** posterior, kg/lb/PC) están en [CHANGELOG.md](CHANGELOG.md) → entrada **2026-09-14**.

Los de Home-as-hub (el **#10** anterior) están en [CHANGELOG.md](CHANGELOG.md) → entrada **2026-09-07 — Home hub**.

Los de v2 (**#0, #2, #3, #4, #5**) están en [CHANGELOG.md](CHANGELOG.md) → entrada **2026-08-30 — v2**.

Los antiguos ítems 2, 3, 4 y 11, y la mitad de peso del antiguo ítem 1, están en [CHANGELOG.md](CHANGELOG.md) → entrada **2026-08-16 — v1**.
