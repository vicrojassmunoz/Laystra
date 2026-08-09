# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Git commits

Never add Claude as a co-author or include any "Generated with Claude Code" / `Co-Authored-By: Claude` trailer in commits. Every commit's authorship stays solely the developer's — no exceptions.

## Branch strategy

`main` holds only working code — no AI-tooling clutter. `dev` is where actual development happens and is the only branch that carries `.claude/` and this `CLAUDE.md`.

- Do all day-to-day work on `dev`. This file and the subagents only exist here.
- When something on `dev` is ready to promote to `main`, do **not** `git merge dev` into `main` — that would drag `.claude/` and `CLAUDE.md` along with it. Instead, from `main`, selectively check out just the working directories:
  ```
  git checkout main
  git checkout dev -- backend mobile .gitignore
  git commit -m "..."
  ```
- If a new top-level working directory is added later, remember to include it explicitly in the checkout list above — it won't come along automatically.

## Project status

Fase 0 backend is done: all MVP endpoints (`/exercises`, `/routines`, `/schedule`, `/today`, `/workouts`, `/exercises/{id}/progress`) implemented against an in-memory seeded store (`app/services/store.py`) — no SQLite yet, that's Fase 1. 24 passing tests.

Fase 0 mobile is scaffolded: Expo TypeScript app with a single working screen (`App.tsx`) that fetches `GET /today` and renders it, with loading/error states. Typechecks clean, Metro boots clean. **Not yet verified on an actual iPhone via Expo Go** — that verification step needs the human, since it requires scanning a QR code on a physical device.

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
eas build --profile development --platform ios    # only needed once native code/config plugins are introduced
eas submit --platform ios
```
No Xcode/simulator commands apply — there is no Mac, so iOS builds and testing on-device both go through EAS/Expo Go, never a local iOS toolchain.

## Product scope

Personal physical-progress tracking app — a side project built for the developer's own use, not a commercial product, so scope should stay tight rather than feature-complete.

Full MVP spec (data model, endpoints, screens, phased test criteria) lives in [`docs/MVP.md`](docs/MVP.md). Post-MVP ideas, deliberately deferred, live in [`docs/ROADMAP.md`](docs/ROADMAP.md) — do not implement anything from there unless the human explicitly pulls it forward. Both are written in Spanish, same as the subagent instructions.

One-line summary: predefined routines assigned to weekdays, log the day's workout in a few taps, see progress over weeks. Explicitly out of scope for the MVP: HealthKit, notifications, multi-user/auth, cloud sync, RPE/RIR, shareable templates, edit-history on past workouts. If mid-task you find yourself designing any of these, stop and go back to `docs/MVP.md`.

Current phase: **Fase 0 — esqueleto conectado** (see `docs/MVP.md`). Backend and mobile are both built; remaining Fase 0 test criteria require the human to run the app on their iPhone via Expo Go and confirm real data renders and a killed backend shows a visible error instead of a crash. Don't start Fase 1 (persistence, routine CRUD, weekly schedule UI) until that's confirmed.

## Intended architecture

This is a personal physical-progress tracking app with two planned components:

- **`backend/`** — FastAPI (Python), SQLite, Pydantic for schemas. Structure is `app/routers/` (one module per resource, exports an `APIRouter`), `app/schemas/` (Pydantic models), `app/services/` (business logic) — not a single `main.py`. REST endpoints with explicit status codes and `HTTPException` error handling, pytest for non-trivial business logic.
- **`mobile/`** — Expo (React Native), TypeScript. Standard, well-documented Expo/RN patterns only — no exotic architectures or heavy state libraries (Redux etc.) until the project actually needs them; prefer `useState`/Context while small.
- iOS builds go through **EAS Build/Submit**, not local Xcode — the developer has an iPhone but no Mac, so the native build pipeline lives entirely in the cloud.

The backend defines the API contract; the mobile app consumes whatever shape the backend returns. Any change to that contract is a cross-cutting concern between the two sides.

## Local development

The mobile app runs on a physical iPhone via Expo Go, not a simulator. `localhost`/`127.0.0.1` in the mobile app will NOT reach a backend running on the developer's machine — use the machine's LAN IP (e.g. `192.168.x.x:8000`) as the API base URL, and keep phone and machine on the same Wi-Fi network.

## Custom subagents (`.claude/agents/`)

This repo defines five project-scoped subagents with a deliberate handoff chain and per-task model tiers:

| Agent | Model | Role |
|---|---|---|
| `explorer` | haiku | Read-only recon. Invoke proactively before starting a new feature to map relevant files, endpoints/schemas, and backend↔frontend dependencies. Never writes code. |
| `backend-coder` | sonnet | Implements/modifies FastAPI backend code. Must state the exact JSON shape of any endpoint the frontend will consume, and flag breaking API changes explicitly. |
| `frontend-coder` | sonnet | Implements/modifies the Expo/RN frontend. Must flag when a change requires leaving Expo Go (native code, config plugins, HealthKit, push notifications, etc.) *before* writing code, since that implies a dev build via EAS. |
| `eas-agent` | sonnet | Owns `eas.json` / `app.config` build profiles (development/preview/production) and EAS secrets/env vars. Called in whenever `frontend-coder` needs to exit Expo Go. |
| `reviewer` | opus | Read-only review after any significant backend/frontend change — correctness, backend↔frontend contract consistency, basic security, non-standard RN patterns. Reports findings as `[bloqueante]`/`[sugerencia]`, never edits code. |

Typical flow: `explorer` → `backend-coder` and/or `frontend-coder` (and `eas-agent` if native/build config is touched) → `reviewer`.

Agent instructions are written in Spanish and should stay that way for consistency.

## Developer context

The developer is senior in backend/Python/FastAPI but has no prior React Native/Expo experience — this is reflected in `frontend-coder`'s instructions (explain RN-specific patterns briefly, don't over-explain backend/Python concepts). There is no Mac available, so all iOS-related guidance must route through EAS rather than assuming local Xcode tooling.