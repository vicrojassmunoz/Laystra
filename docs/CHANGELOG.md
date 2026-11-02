# Changelog — ideas de roadmap entregadas

Historial de ítems que empezaron en [ROADMAP.md](ROADMAP.md) y ya están hechos. Orden cronológico inverso.

---

## 2026-11-02 — Hoy como resumen y Sesión con cronómetro global

Rediseño de la asistencia en sesión (#7) a partir del uso real; adelanta del ítem #8 solo la notificación local de inactividad (la alarma de descanso sigue pendiente).

**Mobile:** `Hoy` pasa a ser el resumen del día; el formulario de logueo se mueve a la nueva pantalla `Sesion` (`SesionScreen`, antes `TodayScreen`). La sesión se arranca/termina explícitamente (▶ Empezar / ■ Terminar); el cronómetro y el borrador viven en `SessionContext`, así que sobreviven a navegar por otras pantallas. Píldora flotante `SessionPill` con el reloj en todas las pantallas mientras la sesión está en curso (toque → vuelve a Sesión). Si pasan 2 h sin teclear nada nuevo llega una notificación local "Ey, ¿sigues por aquí?" (`expo-notifications`, SDK 58).

**Pausa:** ⏸ Pausa / ▶ Reanudar en la barra de Sesión congela sesión y descanso (la píldora y Hoy lo muestran en ámbar); al reanudar los anclajes se desplazan lo que duró la pausa. En pausa no hay aviso de inactividad pendiente; al reanudar la cuenta de 2 h empieza de cero.

**Sin backend nuevo.** El borrador no se persiste en disco: si iOS mata la app, la sesión se pierde.

---

## 2026-11-01 — Sensaciones, PR por volumen, asistencia en sesión y agua

Cierra los ítems de roadmap **#1, #6, #7 y #18**. Todo sigue en Expo Go.

**Backend (aditivo):**
- `Workout.notes` (texto libre, máx. 2000; vacío → `null`) en `POST`/`PUT /workouts`; columna extra `notes` al final del CSV de `/workouts/export`. ADD COLUMN idempotente en `app/db.py`. Ojo: un `PUT` sin `notes` la borra.
- `ProgressPoint.best_set_volume_kg`: mejor serie del día por peso×reps, normalizada a kg.
- Módulo agua (`/water`): entradas en ml con instantánea del nombre del recipiente, recipientes editables (siembra: Vaso 250, Taza 300, Botella 500, Botella grande 1000), objetivo diario (2500 ml por defecto), histórico por días y CSV propio. Tablas nuevas `water_entries`, `water_containers`, `water_settings` (las crea `create_all`).

**Mobile:**
- Hoy y Historial: campo **Sensaciones**; Historial muestra la nota y la reenvía al editar.
- Badge de PR: 🏆 por peso (como antes) y 💪 por volumen de la serie (peso×reps). Solo contra el histórico precargado de los ejercicios del día.
- **Barra de sesión** en Hoy (`SessionBar`): cronómetro de sesión (arranca al escribir la primera serie o con botón), descanso desde la última serie completada, siguiente ejercicio pendiente y tip estático por grupo muscular. Solo en primer plano; la alarma real es el ítem #8. La duración se añade al resumen tras guardar.
- Pantalla **Agua** (tile en Home con progreso): recipientes con toque rápido o **Ajustar** (¼ ½ ¾ 1 y ±50 ml, con aviso si difiere de la capacidad), cantidad libre en ml, confirmación por encima de 1500 ml, deshacer, histórico de 7 días, edición de recipientes (aviso al cambiar capacidad: no reescribe lo ya registrado) y exportar CSV.

**Despliegue:** requiere rebuild del backend (Docker) para los endpoints nuevos; mobile funciona sin build EAS nuevo (solo JS), aunque la app instalada necesita uno para recibir el JS.

---

## 2026-09-14 — Unidades de peso por ejercicio (kg / lb / PC)

Cierra el ítem de roadmap **#10** (unidades; el Home hub de 2026-09-07 fue el #10 anterior, ya retirado).

**Decisión `bw`:** el número logueado es kg ya resuelto al guardar (peso corporal ± lastre), no un porcentaje. `BodyMetric` se puede borrar; recalcular histórico sería inestable.

**Backend:** `Exercise.unit` acepta `kg`\|`lb`\|`bw`. `PUT /exercises/{id}` (mismo body que `POST`) edita nombre/unidad/grupos; si cambia la unidad, convierte los `WorkoutSet.weight` de ese ejercicio (`kg↔lb`; `kg↔bw` sin cambio numérico; `lb↔bw` vía kg). `GET /analytics/summary` expresa `week_tonnage` y volumen muscular siempre en kg (`lb` convertido; `bw` = kg). Seed en DB vacía: Dominadas, Flexiones, Fondos, Plancha (abdomen) nacen en `bw`.

**Mobile:** chip PC al crear/editar en el picker; botón Editar por ejercicio (`PUT`). Hoy/Historial/Progreso muestran `PC` en vez de `bw`. Hoy prefija ejercicios `bw` con el último peso de Perfil.

---

## 2026-09-07 — Home hub (sin bottom tab bar)

Cierra el ítem de roadmap **#10**. Decisión: app arranca en Home; tile grande **Hoy**; resto de pantallas empujadas en el stack nativo (back).

**Mobile:** se elimina `Tab.Navigator` y `@react-navigation/bottom-tabs`. `RootStackParamList` plano (`Home` + Hoy/Rutinas/Semana/Historial/Progreso/Objetivos/User/Analisis). `keyboardVerticalOffset={0}` donde antes se usaba la altura de la tab bar. Semana sigue accesible desde el strip semanal.

**Nota:** al salir de Hoy con back, la pantalla se desmonta — un borrador sin guardar no sobrevive (antes las tabs mantenían el mount).

---

## 2026-08-30 — v2: Backup, Hoy colapsable, ejercicios, CSV

Tanda completa según [V2.md](V2.md). Cierra los ítems de roadmap **#0, #2, #3, #4, #5**.

**Infra:** `backend/scripts/backup_db.ps1` (hot backup SQLite del volumen Docker → OneDrive, retención 14 días) + `restore_db.ps1`. Task Scheduler es un registro one-shot (`-RegisterTask`).

**Backend:** `GET /workouts/export` (CSV UTF-8 con BOM). `POST /exercises` rechaza nombre en blanco.

**Mobile:** Hoy colapsa tarjetas tras guardar; `ExercisePickerList` crea ejercicios (`POST /exercises`); Historial puede añadir un ejercicio al editar y exportar CSV (`expo-file-system` + `expo-sharing`, Expo Go).

**Pendiente en tu máquina:** un build EAS `preview` anterior a SDK 57/v2 hay que reconstruirlo si quieres la app instalada (no Expo Go) con CSV y el mismo SDK.

---

## 2026-08-16 — v1: Perfil, Análisis, Objetivos (+ PR peso, picker Progreso)

Tanda completa según [V1.md](V1.md). Cierra los antiguos ítems de roadmap **#2, #3, #4, #11** y la parte de **#1** referida a badge de PR por peso máximo.

**Backend:** `BodyMetric`, `Goal`, `GET /analytics/summary` (tonelaje 7 días, volumen por músculo, `days_since_trained` por grupo).

**Mobile:** `UserScreen` (Perfil), `AnalisisScreen`, `ObjetivosScreen` dejan de ser placeholders; badge 🏆 PR en `TodayScreen` (peso máx., incl. superseries); `ProgressScreen` usa `ExercisePickerList`.

**Fuera de alcance (como se acordó):** `Goal` no se enlaza automáticamente a entrenos; `BodyMetric` sin edición (borrar + reañadir).

---

## 2026-08-16 — Menú Home

`Home` como tab nueva en primera posición: tira de 7 días (`entrenado`/`perdido`/`descanso`/`pendiente`, calculado en cliente cruzando `GET /schedule` + `GET /workouts`, cero cambios en backend) + grid de accesos a `Objetivos`/`Perfil`/`Análisis` y `Rutinas`/`Historial`.

Primer cambio que saca la app de un único `Tab.Navigator` plano: ahora hay un `Stack.Navigator` raíz (`@react-navigation/native-stack`) para poder empujar pantallas fuera de la tab bar.

---

## 2026-08-14 — Buscador y agrupación por grupo muscular en el picker de ejercicios

Con más alcance del planeado: `Exercise.muscle_group_primary` (catálogo cerrado de 8) + tabla hija `ExerciseSecondaryMuscle` (0 a N secundarios), en vez de un campo plano único. Adelantó la parte de datos del "modelo de músculos" que varios ítems del roadmap dan por hecha. Picker con buscador (ignora acentos) + agrupación, en `RoutinesScreen.tsx`/`TodayScreen.tsx`.
