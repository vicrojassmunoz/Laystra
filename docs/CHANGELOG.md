# Changelog — ideas de roadmap entregadas

Historial de ítems que empezaron en [ROADMAP.md](ROADMAP.md) y ya están hechos. Orden cronológico inverso.

---

## 2026-08-16 — Menú Home

`Home` como tab nueva en primera posición: tira de 7 días (`entrenado`/`perdido`/`descanso`/`pendiente`, calculado en cliente cruzando `GET /schedule` + `GET /workouts`, cero cambios en backend) + grid de accesos a `Objetivos`/`Perfil`/`Análisis` (dummies) y `Rutinas`/`Historial`.

Primer cambio que saca la app de un único `Tab.Navigator` plano: ahora hay un `Stack.Navigator` raíz (`@react-navigation/native-stack`) para poder empujar los tres dummies fuera de la tab bar.

## 2026-08-14 — Buscador y agrupación por grupo muscular en el picker de ejercicios

Con más alcance del planeado: `Exercise.muscle_group_primary` (catálogo cerrado de 8) + tabla hija `ExerciseSecondaryMuscle` (0 a N secundarios), en vez de un campo plano único. Adelantó la parte de datos del "modelo de músculos" que varios ítems del roadmap dan por hecha. Picker con buscador (ignora acentos) + agrupación, en `RoutinesScreen.tsx`/`TodayScreen.tsx`.
