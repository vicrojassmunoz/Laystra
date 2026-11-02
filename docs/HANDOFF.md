# Handoff — estado de Laystra (2026-11-02)

Documento para arrancar una sesión nueva (humana o de Claude) con todo el contexto. Léelo antes de planificar. Complementa: [PRODUCT.md](../PRODUCT.md) (quién usa la app y por qué), [DESIGN.md](../DESIGN.md) (sistema visual y de movimiento), [ROADMAP.md](ROADMAP.md) (ideas), [CHANGELOG.md](CHANGELOG.md) (qué se entregó y cuándo), `mobile/docs/ARCHITECTURE.md` y `backend/docs/ARCHITECTURE.md` (detalle técnico).

## En una frase

Laystra es una app **personal** de progreso físico para iPhone (rutinas por día → sesión que registras en pocos toques → progreso). Hoy está en producción la versión "Native Calm": rediseño completo, sesión con cronómetro, agua, modo oscuro, movimiento y hápticos.

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Repo | `github.com/vicrojassmunoz/Laystra`. `dev` = desarrollo (único con `.claude/`, `.cursor/`, `CLAUDE.md`, `docs/`, `PRODUCT.md`, `DESIGN.md`, `tools/`); `main` = solo `backend/`, `mobile/`, `.gitignore` |
| Último estado | `dev` b57eaa7 · `main` 3ca5e72 (2026-11-02) |
| Backend en producción | `https://laystra.vicrojas.com` — Docker Compose en el PC del dueño (FastAPI + SQLite) + Cloudflare Tunnel |
| App instalada | build EAS `preview` ad-hoc `deb2a6fa` (SDK 58): `https://expo.dev/accounts/vicrojass/projects/laystra/builds/deb2a6fa-ef61-4600-81b9-d7fb974c2dd4` |
| Desarrollo diario | backend local (`uv run uvicorn app.main:app --reload --host 0.0.0.0`) + Expo Go (SDK 58) o vista web (`npx expo start --web`) |
| Backups | `backend/scripts/backup_db.ps1` → OneDrive `Laystra-backups/` (hay uno de 2026-11-02 previo al último deploy) |

## Lo conseguido (hasta el 2026-11-02)

**Base (anterior a hoy):** MVP completo (rutinas, semana, log de entrenos, progreso), super-series, grupos musculares, unidades kg/lb/PC, v1 (perfil/peso corporal, objetivos, análisis, Home), v2 (backup, CSV, crear ejercicios), backend desplegado en Docker + Tunnel, app instalada vía EAS.

**Hoy, funcionalidad:**
- **Notas ("Sensaciones")** en cada entreno (backend `Workout.notes`, Sesión e Historial).
- **PR por volumen** (💪) además del de peso (🏆), y solo la **mejor serie de la sesión** por ejercicio lleva badge (`utils/pr.ts: computePrFlags`).
- **Hoy = resumen del día** y **Sesión = pantalla de logueo** con cronómetro global, descanso, "siguiente ejercicio" y tips; **píldora flotante** en todas las pantallas; **pausa**; **aviso de inactividad** (notificación local a 1 h sin teclear nada); **Completar** (guarda a medias solo las series hechas y termina). El estado vive en `session/SessionContext` (en memoria).
- **Agua:** recipientes editables, ajuste ¼ ½ ¾ ±50 ml con aviso, objetivo diario, histórico 7 días, CSV (backend `/water`).
- **Perfil** nuevo: peso con variación, alta de medidas, **Apariencia (Sistema/Claro/Oscuro)**, ajustes y exportación CSV.
- **Historial** por meses con tarjetas plegables; **Rutinas** plegables con formulario solo al crear/editar; **Progreso** (lista de ejercicios con datos + gráfico desde 3 sesiones); **Análisis** (volumen, músculos olvidados); **Semana** y **Objetivos** rediseñados; **formulario de ejercicios** en hoja propia con Guardar fijo (antes quedaba fuera de vista).
- **Expo SDK 57 → 58**, vista previa web (`showAlert`, CSV por descarga), `expo-font` añadido, notificaciones **solo locales**.

**Hoy, diseño:** sistema "Native Calm" (tema claro/oscuro con tokens en `mobile/src/theme/theme.ts`, componentes `mobile/src/components/ui/`, SF Symbols vía `expo-symbols`, títulos en línea). **Movimiento** con las reglas de Emil Kowalski (`animate-expo`): feedback de pulsación 0.97/120 ms, barras con transición, fundidos cortos, hápticos puntuales. Detalle en DESIGN.md.

## Mapa rápido del código

```
backend/app/{models.py, db.py (migración ALTER idempotente), routers/, schemas/, services/}   110 tests (uv run pytest)
mobile/src/
  theme/        theme.ts (tokens, makeStyles), appearance.ts (Sistema/Claro/Oscuro + AsyncStorage)
  motion/       motion.ts (curvas, transition(), haptic.*)
  session/      SessionContext.tsx (cronómetro, pausa, borrador del entreno, notificación de inactividad)
  components/   ui/ (Txt, Button, Card/Section, Row, Chip, TextField, ProgressBar, PressableScale, Icon...), SetRow, SupersetBlock, SessionBar/Pill...
  screens/      Home, Hoy, Sesion, Agua, Perfil(User), Historial, Rutinas, Progreso, Analisis, Semana, Objetivos
  utils/        pr.ts, workoutSummary.ts, shareCsv.ts, alert.ts (showAlert), water.ts...
```

## Cómo trabajar (reglas del proyecto)

- **Commits:** nunca añadir a Claude como co-autor ni trailers. Trabajo en `dev`.
- **Promover a producción** (cuando el dueño dice "ship / pasa a producción"): 1) `git checkout main && git checkout dev -- backend mobile .gitignore && git commit && git push origin main` (**nunca** `git merge dev`); 2) `cd backend && docker compose up -d --build` y verificar `https://laystra.vicrojas.com/health` y endpoints nuevos; 3) `cd mobile && npx eas build --platform ios --profile preview --non-interactive`; esperar a "Uploaded to EAS" antes de volver a `dev`. **Antes:** backup (`backup_db.ps1`), `uv run pytest`, `npm run typecheck`, `npx expo-doctor`. No hay CI: nada se despliega solo.
- **SDK:** `mobile/AGENTS.md` fija SDK 58 = el Expo Go del iPhone. No subir sin comprobar que Expo Go coincide. Leer docs de la versión exacta.
- **Ver la UI sin Mac:** `tools/visual/` (Playwright + Helium sobre la vista web). Ver su README. La web NO es la verdad del iPhone.

## Lecciones y cautelas

- **Errores solo nativos:** la vista web y `expo export` no los detectan (p. ej. la curva `cubic-bezier("…")` de Reanimated funcionaba en web y petaba en iPhone → hay que usar `cubicBezier()`). Tras tocar algo nativo, pedir una comprobación en Expo Go; nunca dar por "verificado" solo con el navegador.
- **Entitlement push:** `expo-notifications` debe seguir con `enableRemoteNotifications: false`; si no, el build ad-hoc falla (el provisioning profile no tiene Push). Comprobar: `npx expo config --type introspect --json` → `ios.entitlements` vacío.
- **Capabilities nuevas (HealthKit, etc.)** necesitarán regenerar el provisioning profile (login de Apple, interactivo). Ojo: el build "Retry" de la web de EAS reutiliza el commit viejo.
- **Datos:** el Docker de producción tenía **0 entrenos** el 2026-11-02; las rutinas/entrenos reales del dueño viven en su `laystra.db` local (el que usa con Expo Go). La app instalada empieza vacía. El horario semanal estaba todo en "Descanso".
- **Entorno:** Node 25 no está en el rango soportado por RN 0.88 (22/24/26+) — funciona, pero conviene Node 24 LTS. `npm audit` marca ~17 vulnerabilidades sin revisar. La IP LAN del PC cambia (`mobile/.env` → `EXPO_PUBLIC_API_URL`); conviene reserva DHCP.

## Deuda técnica / pendientes menores

- Filas y hojas de los **pickers de ejercicio** (Sesión, Rutinas, Historial) siguen con estilos antiguos con tema (`ui/compat`); unificar en un `Sheet` + `PickerOption`.
- **Sin tests JS** (solo `tsc`); la lógica de `pr.ts`, `superset.ts`, `workoutSummary.ts` se comprobó con scripts ad hoc. Candidata a Jest.
- No se ha pasado `reviewer` / `/code-review` sobre el trabajo del 2026-11-02 (es mucho código nuevo).
- La sesión y el borrador viven **en memoria**: si iOS mata la app se pierden (AsyncStorage ya está instalado). La duración de cada entreno no se guarda en el backend.
- Hápticos, escala de pulsación y modo oscuro en el iPhone: implementados y revisados en web, **pendientes de juicio del dueño en el build real**.
- Android no está soportado (decisión: iPhone primero; la vista web es solo para diseño).

## Candidatos para el futuro (para planificar)

| Idea | Notas |
|---|---|
| **Temporizador de descanso con alarma (ROADMAP #8)** | Ahora más barato: las notificaciones locales ya funcionan en el build instalado; probablemente solo JS (cuenta atrás por serie + `scheduleNotificationAsync`) |
| **Pasos (#19) / HealthKit (#17)** | Versión barata: `expo-sensors` Pedometer (solo iPhone, ~7 días). Completa: HealthKit = nueva capability → perfil de provisioning + build + textos de privacidad |
| **Migrar datos dev → producción** | Copiar rutinas/entrenos/ejercicios del `laystra.db` local al Docker (con backup); decidir qué conservar |
| **Persistir la sesión** | Que sobreviva a que iOS cierre la app; guardar duración en el entreno y mostrarla en Hoy/Historial |
| **Calidad** | Jest para utils puras, pasar `reviewer`, unificar pickers, revisar auditoría npm, Node 24 |
| **Análisis más útil** | Balance/split desacoplado (#12), tendencias semana a semana, PRs recientes |
| **IA que lea el histórico (#15)** | Necesita más datos; las notas ya alimentan esto |
| **Strava (#16)** | OAuth + tokens + jobs; coste alto |
| **"Amigos más adelante" (PRODUCT.md)** | Fork grande: implica cuentas/multiusuario en el backend; decidir si se persigue |
| **Idea sin investigar** | Cronómetro de sesión en la pantalla de bloqueo / Dynamic Island (Live Activity); requiere extensión nativa |

## Cómo empezar la próxima sesión

1. Pedir a Claude que lea `docs/HANDOFF.md`, `PRODUCT.md`, `DESIGN.md` y `docs/ROADMAP.md`.
2. Decidir el tema (p. ej. "planear #8 + pasos", "migrar mis datos a producción", "robustez: tests y revisión").
3. Para tocar la UI, usar las skills instaladas (`impeccable`, `animate-expo`, `emil-design-eng`) y `tools/visual/` para ver el resultado; recordar pedir comprobación en Expo Go de todo lo nativo.
