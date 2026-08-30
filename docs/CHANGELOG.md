# Changelog — ideas de roadmap entregadas

Historial de ítems que empezaron en [ROADMAP.md](ROADMAP.md) y ya están hechos. Orden cronológico inverso.

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
