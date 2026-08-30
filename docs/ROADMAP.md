# Roadmap de ideas futuras — App de progreso físico

No tocan el MVP actual (rutinas + calendario + log + progreso, ver [MVP.md](MVP.md)). **No implementar nada de aquí a menos que se pida explícitamente.**

Entregado: [CHANGELOG.md](CHANGELOG.md). Spec de la última tanda cerrada: [V1.md](V1.md).

**Leyenda de columnas:** *Capa* = backend / mobile / ambos. *Expo Go* = si funciona sin development build.

---

## Próxima tanda sugerida (v2)

Bloque cohesionado, todo Expo Go salvo el backup (infra). Orden recomendado:

1. **#0** — Backup de `laystra.db` (bloqueante; sin esto el resto es riesgo)
2. **#2** — Colapsar ejercicios en Hoy tras guardar
3. **#3 + #4** — Crear ejercicios desde la app + añadirlos al editar Historial
4. **#5** — Exportar entrenos a CSV (complementa el backup)

Cuando se decida implementar, escribir un `V2.md` con el mismo formato que `V1.md` (alcance, fuera de alcance, endpoints, pantallas, tests de avance).

---

## Backlog priorizado

### Ahora — coste barato

| # | Ítem | Capa | Expo Go | Depende de | Hecho cuando | Descripción |
|---|------|------|---------|------------|--------------|-------------|
| 0 | **Backup de `laystra.db`** | infra | — | — | Copia diaria fuera del PC; restauración probada una vez | `laystra.db` vive en un único volumen Docker (`laystra-db`, ver `backend/docker-compose.yml`). Job con cron/Task Scheduler: `sqlite3 laystra.db ".backup /ruta/copia.db"` (o `VACUUM INTO`) + subida a cloud/OneDrive. **Prioridad bloqueante** — un `docker volume prune` o disco muerto borra todo el histórico. |
| 1 | PR por **volumen** (peso×reps) | ambos | sí | — | Badge o indicador en Hoy al batir mejor serie por volumen, no solo por peso | El badge de PR por **peso máximo** ya está en v1 (ver CHANGELOG). Falta la segunda mitad del ítem original: mejor serie por volumen por ejercicio. |
| 2 | Colapsar/expandir ejercicios en "Hoy" tras guardar | mobile | sí | — | Tarjeta guardada muestra solo nombre; tocar reexpande | Puramente UI, estado local. |
| 3 | Crear ejercicios nuevos desde la app (kg/lb) | mobile | sí | — | "+ Nuevo ejercicio" en el picker; persiste vía `POST /exercises` | `POST /exercises` ya soporta `unit`. Afecta todos los pickers (`ExercisePickerList`), no solo Rutinas. |
| 4 | Añadir ejercicio al editar un entreno pasado | mobile | sí | #3 | Desde Historial se puede añadir un ejercicio que el workout no tenía | Hoy la edición solo permite tocar ejercicios ya presentes. Reutiliza picker + flujo de #3. |
| 5 | Exportar entrenos a CSV | ambos | sí | — | Descarga/compartir CSV con fecha, ejercicio, peso, reps | Endpoint que recorra `Workout`/`WorkoutSet`. Móvil: `expo-sharing` + `expo-file-system`. |
| 6 | Sensaciones en el registro (`notes`) | ambos | sí | — | Campo texto libre en workout o set; persiste y se muestra en Historial | Que una IA las lea es ítem #15; esto es solo captura. |
| 7 | Asistencia en sesión (sin notificaciones) | mobile | sí | — | Timer de sesión + siguiente ejercicio + tips estáticos + log en descanso | Todo en Expo Go. Base para ítem #13. |

### Después — coste medio

| # | Ítem | Capa | Expo Go | Depende de | Hecho cuando | Descripción |
|---|------|------|---------|------------|--------------|-------------|
| 8 | Temporizador de descanso con alarma real | mobile | **no** (EAS) | — | Alarma suena con app en background | Primer salto fuera de Expo Go (`eas-agent`). Notificaciones locales fiables. |
| 9 | Home con silueta de cuerpo tapeable | mobile | sí | — | Tocar región del SVG filtra/navega por grupo muscular | `react-native-svg` + asset con regiones mapeadas a las 8 categorías de `muscle_group_primary`. |
| 10 | Quitar bottom tab bar; `Home` como hub | mobile | sí | **decisión** | Navegación usable con acceso diario a Hoy resuelto | 6 tabs sobrecargan la barra. **Decisión pendiente antes de implementar:** ¿Hoy como única tab superviviente? ¿FAB? ¿Tile en Home + atajo? Sin decisión, no codificar. |

### Algún día — coste grande

| # | Ítem | Capa | Expo Go | Depende de | Hecho cuando | Descripción |
|---|------|------|---------|------------|--------------|-------------|
| 11 | Tipos de sesión (fuerza / cardio / otro) | ambos | — | — | Modelo que soporte cardio (distancia/tiempo) sin romper fuerza | **`Goal` manual ya existe (v1)** — esto es otra cosa: generalizar `Workout`/`Session` con `session_type` y campos por tipo. **Decisión vigente: no hacerlo** hasta que cardio sea un plan real, no "por si acaso". |
| 12 | Split/balance desacoplado del calendario | ambos | sí | — | Usuario define split propio; app prioriza por desfase muscular | Usa datos de "días sin entrenar" (ya en Análisis, v1). Reengancha con #11 si hay categorías no-fuerza. |
| 13 | Análisis en directo durante la sesión | mobile | sí* | #7, #8 | Sugerencias reactivas al loguear cada set | Lógica en tiempo real, no post-sesión. *Alarma en background requiere #8 (EAS). Solo cuando #7+#8 estén maduros en uso real. |
| 14 | Modos visuales (fitness / videojuego / minimalista) | mobile | sí | #11 o #12 | Tres pieles, preferencia local | Theming en cada pantalla. Pulido, no core. |
| 15 | IA para analizar registro y planificar | ambos | — | histórico + #6 | Endpoint LLM con sugerencias útiles | Dificultad real = tener datos suficientes. `notes` (#6) alimentan esto. |
| 16 | Integración Strava | ambos | — | — | OAuth + sync de actividades | Infraestructura OAuth, tokens, jobs. |
| 17 | Apple Health / HealthKit | mobile | **no** (EAS) | #8 | Lectura/escritura de métricas acordadas | Config plugin + development build. |

---

## Ítems retirados del backlog (entregados en v1)

Los antiguos ítems 2, 3, 4 y 11, y la mitad de peso del antiguo ítem 1, están en [CHANGELOG.md](CHANGELOG.md) → entrada **2026-08-16 — v1**.
