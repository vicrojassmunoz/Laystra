# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git commits

Never add Claude as a co-author or include any "Generated with Claude Code" / `Co-Authored-By: Claude` trailer in commits. Every commit's authorship stays solely the developer's — no exceptions.

## Branch strategy

`main` holds only working code — no AI-tooling clutter. `dev` is where actual development happens and is the only branch that carries `.cursor/`, `.claude/`, `AGENTS.md`, and this `CLAUDE.md`.

- Do all day-to-day work on `dev`. This file and the subagents only exist here.
- When something on `dev` is ready to promote to `main`, do **not** `git merge dev` into `main` — that would drag `.claude/` and `CLAUDE.md` along with it. Instead, from `main`, selectively check out just the working directories:
  ```
  git checkout main
  git checkout dev -- backend mobile .gitignore
  git commit -m "..."
  ```
- If a new top-level working directory is added later, remember to include it explicitly in the checkout list above — it won't come along automatically.

## Project status

Fase 0 backend is done: all MVP endpoints (`/exercises`, `/routines`, `/schedule`, `/today`, `/workouts`, `/exercises/{id}/progress`) implemented against an in-memory seeded store — no SQLite yet, that came in Fase 1.

Fase 0 mobile is done: Expo TypeScript app with a single working screen (`App.tsx`) that fetches `GET /today` and renders it, with loading/error states. Verified on a physical iPhone via Expo Go — real data renders, rest days show correctly, killing the backend surfaces a visible error instead of a crash. Pinned to Expo SDK 54 (not the just-released 57) because the App Store's Expo Go client hadn't caught up yet as of 2026-08-09 — see `mobile/AGENTS.md`.

Fase 1 backend is done: the in-memory store (`app/services/store.py`) was replaced with real persistence via SQLAlchemy + SQLite (`app/db.py`, `app/models.py`, `app/seed.py`). `GET /schedule` now always returns all 7 days by construction, `PUT /schedule/{day}` uses FastAPI's native path validation, SQLite foreign-key enforcement is on (`PRAGMA foreign_keys=ON`), and `PUT`/`DELETE /routines/{id}` were added so a routine can be edited or removed — deleting one auto-clears (`ondelete="SET NULL"`) any day/workout that referenced it instead of blocking the delete. 30 passing tests.

Fase 1 mobile is done: added bottom-tab navigation (Hoy / Rutinas / Semana) via `@react-navigation`. "Rutinas" lists existing routines and has a form to create, edit, and delete them (exercise picker as a modal, not the inline iOS `Picker` wheel — that stacked badly with multiple rows). "Semana" shows the 7-day schedule and lets you assign a routine or rest day per day via a modal. All three tab screens refetch on focus (`useFocusEffect`), not just on mount, since React Navigation keeps tab screens mounted when switching tabs. Verified on a physical iPhone: create/edit/delete routines, assign them across the week, restart the backend, everything persists.

Fase 2 backend is done: `POST/GET /workouts`, `GET /workouts/{id}`, and `GET /today` were already real (not hardcoded) from earlier work. Mid-phase, `RoutineExercise` was simplified to drop `target_reps` — a routine now only fixes `target_sets` per exercise, reps/weight are decided entirely at log time (breaking schema change, `laystra.db` was reset once for it). Also mid-phase, `PUT /workouts/{id}` was added — a deliberate, user-requested exception pulled forward from the MVP's "no editing past workouts" exclusion; it's a plain overwrite (same `cascade="all, delete-orphan"` replace pattern as `PUT /routines/{id}`), no edit-history/audit trail, which stays excluded. 35 passing tests.

Fase 2 mobile is done: `TodayScreen` rewritten into a real logging form — per-set weight/reps inputs pre-filled to `target_sets` rows, "+ añadir serie"/"Quitar" to adjust, weight auto-fills across a set's empty rows, Spanish decimal-comma input normalized, and the draft now survives tab switches (keyed on date+routine+exercise signature, not on every refocus) so a saved state doesn't quietly reset. New `HistorialScreen` (4th tab) lists past workouts grouped by exercise and supports inline per-workout editing (same dynamic-row pattern, can't add a brand-new exercise to a past workout — noted in `docs/ROADMAP.md`). `KeyboardAvoidingView` across `RoutinasScreen`/`TodayScreen`/`HistorialScreen` now uses `useBottomTabBarHeight()` as `keyboardVerticalOffset` — without it the save button hid behind the keyboard, since the plain `"padding"` behavior didn't account for the tab bar. Verified on a physical iPhone. The seed list (`app/seed.py`) was also expanded from 5 to 24 exercises with the developer's real ones (2026-08-10), inserted into the live `laystra.db` without touching existing routines/workouts.

Fase 3 is done: `DELETE /workouts/{id}` + a "Borrar" card button in Historial, and `TodayScreen`'s "Loguear otro entreno" now keeps the just-saved workout visibly summarized instead of hiding it, and lets you pick a different existing routine or a free-form session (`Workout.routine_id` nullable, exercise picker like `RoutinesScreen.tsx`'s) instead of only re-logging today's assigned routine. Core deliverable — a 5th `ProgressScreen` tab — added on top of the existing `GET /exercises/{id}/progress` (no backend changes needed there beyond an `id` tie-break on the date ordering, to match `list_workouts`'s ordering when two workouts share a date). `reviewer` caught a real bug pre-merge: `ProgressScreen`'s `useFocusEffect` held a stale closure and never refreshed on refocus — fixed with the same ref pattern `TodayScreen` already uses. Verified on a physical iPhone.

Fase 4 backend deployment is done: self-hosted via Docker Compose (`backend/Dockerfile`, `backend/docker-compose.yml`) — `backend` (FastAPI + `uv`) plus `cloudflared` (Cloudflare Tunnel), reachable at `https://laystra.vicrojas.com` on the developer's own domain (`vicrojas.com`, Namecheap, nameservers pointed at Cloudflare), no ports forwarded on the router. This wasn't the original plan: a first attempt with Caddy + DuckDNS + router port-forwarding turned out unworkable because the developer's residential ISP (Digi) uses CGNAT, confirmed through exhaustive troubleshooting (router firewall, forwarding rules, source-IP range, router reboot — a fresh unused test port still showed closed from two independent external checkers). The tunnel approach sidesteps CGNAT entirely since it's outbound-only. Full writeup in `backend/docs/ARCHITECTURE.md` → "Despliegue (Fase 4)". Docker Desktop auto-starts at sign-in and containers use `restart: unless-stopped`, so a PC reboot self-heals without manual intervention. Verified end-to-end 2026-08-13: `/health` and `/exercises` both serve real data through the public HTTPS URL.

Fase 4 mobile/EAS setup is done: Expo/EAS account created, project created and linked (`@vicrojass/laystra`, `projectId` written into `app.json` by `eas init`), `eas.json` has `development`/`preview`/`production` build profiles with `EXPO_PUBLIC_API_URL` set per profile (preview/production point at the public HTTPS domain, not a LAN IP). Apple Developer Program enrollment cleared 2026-08-16 (originally deferred for budget reasons, ~3 days early). `eas build --platform ios --profile preview` was run successfully and the build installed directly on the developer's physical iPhone (ad-hoc/internal distribution, not through TestFlight) — verified pulling real data from the production backend. `eas submit`/TestFlight was deliberately skipped: this is a personal single-device app, so the ad-hoc install satisfies the need without the extra App Store Connect step.

**v1 — Menú Home implemented (2026-08-16), verified on-device:** first post-MVP feature, from `docs/ROADMAP.md` → "v1". `Home` is a new first tab (bottom bar now has 6: Home/Hoy/Rutinas/Semana/Historial/Progreso) showing a 7-day status strip (`entrenado`/`perdido`/`descanso`/`pendiente`, derived client-side by cross-referencing `GET /schedule` with `GET /workouts` — zero backend changes) plus a tile grid with quick access to `Semana`/`Rutinas`/`Historial` and three screens pushed from it (`Objetivos`, `Perfil`, `Análisis` — see the v1 entry below, they're no longer placeholders). This is the **first time the app has more than one navigator**: `App.tsx` now wraps the existing `Tab.Navigator` in a root `Stack.Navigator` (`@react-navigation/native-stack`, new JS-only dependency, no Expo Go exit needed) so those three screens can be pushed outside the tab bar with a native back button.

## Commands

Backend (Python/FastAPI, run from `backend/`, dependencies managed via `uv` + `pyproject.toml`):
```
uv sync                                                  # creates .venv and installs from pyproject.toml/uv.lock
uv run uvicorn app.main:app --reload --host 0.0.0.0      # --host 0.0.0.0 required: phone hits this over LAN, not localhost
uv run pytest                                            # uv run pytest path/to/test_file.py::test_name for a single test
uv add <package>                                         # add a dependency (writes to pyproject.toml + uv.lock)
```

Mobile (Expo/TypeScript, run from `mobile/`):
```
npm install
cp .env.example .env && $EDITOR .env             # set EXPO_PUBLIC_API_URL to your machine's LAN IP
npx expo start                                    # scan QR with Expo Go on the iPhone
npx tsc --noEmit                                  # typecheck
eas build --platform ios --profile preview        # standalone build, ad-hoc install on-device; needs Apple Developer Program enrolled
eas submit --platform ios                         # only if TestFlight distribution is wanted later; not used so far (personal single-device app)
```
No Xcode/simulator commands apply — there is no Mac, so iOS builds and testing on-device both go through EAS/Expo Go, never a local iOS toolchain.

Backend production (Docker, run from `backend/`): see `backend/README.md` → "Run in Docker (production)".

## Product scope

Personal physical-progress tracking app — a side project built for the developer's own use, not a commercial product, so scope should stay tight rather than feature-complete.

Full MVP spec (data model, endpoints, screens, phased test criteria) lives in [`docs/MVP.md`](docs/MVP.md). Post-MVP ideas, deliberately deferred, live in [`docs/ROADMAP.md`](docs/ROADMAP.md) — do not implement anything from there unless the human explicitly pulls it forward. Roadmap items already delivered move to [`docs/CHANGELOG.md`](docs/CHANGELOG.md). All three are written in Spanish, same as the subagent instructions.

One-line summary: predefined routines assigned to weekdays, log the day's workout in a few taps, see progress over weeks. Explicitly out of scope for the MVP: HealthKit, notifications, multi-user/auth, cloud sync, RPE/RIR, shareable templates, edit-history on past workouts. If mid-task you find yourself designing any of these, stop and go back to `docs/MVP.md`.

**Fase 0 — esqueleto conectado is done** (verified on-device 2026-08-09: `/docs` lists all endpoints, the Expo app renders real backend data over Expo Go, and killing the backend shows a visible error instead of a crash).

**Fase 1 — rutinas y calendario semanal is done** (verified on-device 2026-08-10: create/edit/delete routines and assign them to weekdays from the phone, restart the backend, everything survives in SQLite).

**Fase 2 — loguear el "Hoy" is done** (verified on-device 2026-08-10: pre-filled today's routine, log real sets/reps in a few taps, persisted as a `Workout`, survives a backend restart, shows up in Historial, invalid input doesn't crash).

**Fase 3 — progreso is done** (verified on-device 2026-08-11: with 3+ logged workouts for the same exercise on different dates, the progress screen shows the evolution correctly ordered; an exercise with no history shows a reasonable empty state instead of breaking).

**Fase 4 — fuera de tu ordenador is done** (see `docs/MVP.md`): backend deployment is done and verified (`https://laystra.vicrojas.com`, self-hosted via Docker Compose + Cloudflare Tunnel), and a real EAS build (`preview` profile) is installed on the developer's physical iPhone, verified pulling real data from the production backend (2026-08-16). TestFlight/`eas submit` was skipped by choice — personal single-device app, ad-hoc install is enough. Don't design anything from `docs/ROADMAP.md` (muscle groups, splits, AI analysis, etc.) unless the human explicitly pulls it forward.

## Intended architecture

This is a personal physical-progress tracking app with two planned components:

- **`backend/`** — FastAPI (Python), SQLite, Pydantic for schemas. Structure is `app/routers/` (one module per resource, exports an `APIRouter`), `app/schemas/` (Pydantic models), `app/services/` (business logic) — not a single `main.py`. REST endpoints with explicit status codes and `HTTPException` error handling, pytest for non-trivial business logic.
- **`mobile/`** — Expo (React Native), TypeScript. Standard, well-documented Expo/RN patterns only — no exotic architectures or heavy state libraries (Redux etc.) until the project actually needs them; prefer `useState`/Context while small.
- iOS builds go through **EAS Build/Submit**, not local Xcode — the developer has an iPhone but no Mac, so the native build pipeline lives entirely in the cloud.

The backend defines the API contract; the mobile app consumes whatever shape the backend returns. Any change to that contract is a cross-cutting concern between the two sides.

## Local development

The mobile app runs on a physical iPhone via Expo Go, not a simulator. `localhost`/`127.0.0.1` in the mobile app will NOT reach a backend running on the developer's machine — use the machine's LAN IP (e.g. `192.168.x.x:8000`) as the API base URL, and keep phone and machine on the same Wi-Fi network.

## Cursor (`.cursor/`)

This repo also runs in **Cursor** with subagents in `.cursor/agents/`, rules in `.cursor/rules/`, and hooks in `.cursor/hooks.json`. See [`AGENTS.md`](AGENTS.md) for the full workflow (`explorer` → implement → `verifier` → `reviewer`). Cursor takes precedence over `.claude/agents/` when both define the same subagent name.

## Custom subagents (`.claude/agents/`)

This repo defines six project-scoped subagents with a deliberate handoff chain and per-task model tiers:

| Agent | Model | Role |
|---|---|---|
| `explorer` | haiku | Read-only recon. Invoke proactively before starting a new feature to map relevant files, endpoints/schemas, and backend↔frontend dependencies. Never writes code. |
| `backend-coder` | sonnet | Implements/modifies FastAPI backend code. Must state the exact JSON shape of any endpoint the frontend will consume, and flag breaking API changes explicitly. |
| `frontend-coder` | sonnet | Implements/modifies the Expo/RN frontend. Must flag when a change requires leaving Expo Go (native code, config plugins, HealthKit, push notifications, etc.) *before* writing code, since that implies a dev build via EAS. |
| `eas-agent` | sonnet | Owns `eas.json` / `app.config` build profiles (development/preview/production) and EAS secrets/env vars. Called in whenever `frontend-coder` needs to exit Expo Go. |
| `reviewer` | opus | Read-only review after any significant backend/frontend change — correctness, backend↔frontend contract consistency, basic security, non-standard RN patterns. Reports findings as `[bloqueante]`/`[sugerencia]`, never edits code. |
| `backend-docs` | sonnet | Keeps `backend/docs/ARCHITECTURE.md` in sync with the actual backend code (endpoints, schemas, where state lives). Its only allowed write target is that one file — never app code. Auto-triggered after `backend-coder` finishes (see hook below); also invokable manually. |

Typical flow: `explorer` → `backend-coder` and/or `frontend-coder` (and `eas-agent` if native/build config is touched) → `reviewer`. `backend-docs` runs automatically whenever `backend-coder` finishes, via a `SubagentStop` hook in `.claude/settings.json`.

Agent instructions are written in Spanish and should stay that way for consistency.

**Caveat observed 2026-08-09:** changes under `.claude/agents/` (both new files AND edits to existing ones, e.g. adding a tool to an agent's frontmatter) and changes to `.claude/settings.json` are not picked up mid-session — confirmed twice: once when `backend-coder` couldn't be invoked at all right after `backend-docs` was added, and again when an already-running `backend-coder` self-reported it still lacked the `Agent` tool after that grant was added to its frontmatter mid-session. If a subagent invocation fails with "Agent type not found," an agent claims to lack a tool you just gave it, or a hook doesn't seem to fire, the fix is a session restart — not a sign the config is wrong. The `SubagentStop` hook that triggers `backend-docs` also had a real bug independent of this: without per-invocation state it re-fires on every one of `backend-coder`'s subsequent turns (including the one where it acts on the reminder), looping until the harness force-stops it. Fixed by keying a marker file on the hook's `agent_id` field (`.claude/hooks/backend_docs_notify.py`) so it fires exactly once per `backend-coder` run.

## Developer context

The developer is senior in backend/Python/FastAPI but has no prior React Native/Expo experience — this is reflected in `frontend-coder`'s instructions (explain RN-specific patterns briefly, don't over-explain backend/Python concepts). There is no Mac available, so all iOS-related guidance must route through EAS rather than assuming local Xcode tooling.