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
| `HistorialScreen` | `exercises`, `routines`, `workouts` |
| `ProgressScreen` | `exercises`, `progress` |
| `ObjetivosScreen` | `goals` |
| `UserScreen` | `bodyMetrics`, `today` |
| `AnalisisScreen` | `analytics` |

## Estructura de carpetas

- `src/screens/` — una pantalla por fichero; refetch con `useFocusEffect`
- `src/api/` — un módulo por recurso REST; patrón `fetch` + `buildErrorMessage` (`http.ts`)
- `src/types/` — tipos TS (excepto `TodayResponse`, que vive en `api/today.ts`)
- `src/components/` — `ExercisePickerList`, `SupersetBlock`, `MenuTile`, `PrBadge`
- `src/utils/` — `number.ts` (coma decimal), `exercisePicker.ts` (grupos musculares), `superset.ts`
- `src/config.ts` — `EXPO_PUBLIC_API_URL`

## Convenciones obligatorias

1. **Refetch al foco:** `useFocusEffect` + `useRef` para callbacks actuales (evitar stale closures).
2. **Teclado + tab bar:** `KeyboardAvoidingView` con `keyboardVerticalOffset={useBottomTabBarHeight()}`.
3. **Fecha Today:** helper ISO del repo para `GET /today?date=`.
4. **Números:** normalizar coma decimal con `utils/number.ts`.
5. **Picker ejercicios:** siempre `ExercisePickerList` (buscador + agrupación por músculo).
6. **Estado:** `useState` local; sin Redux/Context global salvo necesidad real.
7. **Estilos:** `StyleSheet.create` inline por pantalla.

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
