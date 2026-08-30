# Arquitectura mobile — Laystra

App Expo (React Native) + TypeScript, SDK 54. Consume la API REST del backend FastAPI.

## Navegación

```
Stack.Navigator (root)
├── Tabs (6 tabs)
│   ├── Home
│   ├── Hoy (Today)
│   ├── Rutinas
│   ├── Semana (Schedule)
│   ├── Historial
│   └── Progreso (Progress)
├── Objetivos
├── Perfil (User)
└── Análisis
```

Tipos: `src/types/navigation.ts` (`TabParamList`, `RootStackParamList`).

## Pantallas → API

| Pantalla | Módulos API |
|----------|-------------|
| `HomeScreen` | `schedule`, `today`, `workouts` |
| `TodayScreen` | `today`, `exercises`, `routines`, `workouts`, `progress` |
| `RoutinesScreen` | `exercises`, `routines` |
| `ScheduleScreen` | `schedule`, `routines` |
| `HistorialScreen` | `exercises`, `routines`, `workouts` (`GET /workouts/export`) |
| `ProgressScreen` | `exercises`, `progress` |
| `ObjetivosScreen` | `goals` |
| `UserScreen` | `bodyMetrics`, `today` |
| `AnalisisScreen` | `analytics` |

## Estructura de carpetas

- `src/screens/` — una pantalla por fichero; refetch con `useFocusEffect`
- `src/api/` — un módulo por recurso REST; patrón `fetch` + `buildErrorMessage` (`http.ts`)
- `src/types/` — tipos TS (excepto `TodayResponse`, que vive en `api/today.ts`)
- `src/components/` — `ExercisePickerList` (buscador, grupos, `POST /exercises`), `SupersetBlock` (`collapsed` en Hoy post-save), `MenuTile`, `PrBadge`
- `src/utils/` — `number.ts` (coma decimal), `exercisePicker.ts` (grupos musculares), `superset.ts`
- `src/config.ts` — `EXPO_PUBLIC_API_URL`

## Convenciones obligatorias

1. **Refetch al foco:** `useFocusEffect` + `useRef` para callbacks actuales (evitar stale closures).
2. **Teclado + tab bar:** `KeyboardAvoidingView` con `keyboardVerticalOffset={useBottomTabBarHeight()}`.
3. **Fecha Today:** helper ISO del repo para `GET /today?date=`.
4. **Números:** normalizar coma decimal con `utils/number.ts`.
5. **Picker ejercicios:** siempre `ExercisePickerList` (buscador + agrupación + "+ Nuevo ejercicio"). Usado en Rutinas (2 pickers), Hoy (entreno libre + superserie), Progreso, Historial. Tras `POST /exercises` (`createExercise` en `api/exercises.ts`) el padre mete el ítem en su lista vía `onCreated`. Formulario: nombre, unidad kg/lb, grupo principal obligatorio (chips de `MUSCLE_GROUP_ORDER`), secundarios opcionales.
6. **Estado:** `useState` local; sin Redux/Context global salvo necesidad real.
7. **Estilos:** `StyleSheet.create` inline por pantalla.
8. **CSV:** `File`/`Paths` de `expo-file-system` 19 (SDK 54). **No** usar `writeAsStringAsync` del import principal — lanza en runtime. Share con `expo-sharing` `shareAsync`. Sigue en Expo Go.

## Hoy e Historial

**Hoy:** tras guardar (`submitted`), las tarjetas sueltas y `SupersetBlock` nacen colapsadas (solo nombre; tap reexpande). Estado local `expandedAfterSave` (Set de keys; vacío = todo colapsado). Mientras se edita, abiertas como antes.

**Historial:** en edición, "Añadir ejercicio" abre el mismo picker (puede crear uno). `PUT /workouts/{id}` ya aceptaba sets extra. Botón "Exportar CSV" arriba: `exportWorkoutsCsv()` → `new File(Paths.cache, "laystra-workouts.csv")` + `Sharing.shareAsync`.

## Contrato API

Tipos duplicados a mano respecto al backend. Mapa completo: `.cursor/rules/api-contract.mdc`.

Catálogos sincronizados manualmente:
- `MUSCLE_GROUP_ORDER` (`utils/exercisePicker.ts`) ↔ `muscle_taxonomy.py`
- `validSupersetGroups` (`utils/superset.ts`) ↔ `services/superset.py`

## Verificación

```bash
npm run typecheck   # desde mobile/
```

Sin tests unitarios por ahora — verificación en dispositivo vía Expo Go o build EAS `preview`.

## Build

Sin Mac — iOS vía EAS. Ver `eas.json` y subagente `eas-agent`. Salir de Expo Go implica development build.

Dependencias nativas en Expo Go (directas en `package.json`): `expo-file-system` ~19, `expo-sharing` ~14. No fuerzan development build. El build EAS `preview` instalado antes de v2 **no** incluye esos módulos: "Exportar CSV" en esa instalación fallará hasta un `eas build --platform ios --profile preview` nuevo. En Expo Go funciona ya.
