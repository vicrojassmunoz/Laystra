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

Fase 0 mobile is done: Expo TypeScript app with a single working screen (`App.tsx`) that fetches `GET /today` and renders it, with loading/error states. Verified on a physical iPhone via Expo Go — real data renders, rest days show correctly, killing the backend surfaces a visible error instead of a crash. Pinned to Expo SDK 54 (not the just-released 57) because the App Store's Expo Go client hadn't caught up yet as of 2026-08-09 — see `mobile/AGENTS.md`.

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

**Fase 0 — esqueleto conectado is done** (verified on-device 2026-08-09: `/docs` lists all endpoints, the Expo app renders real backend data over Expo Go, and killing the backend shows a visible error instead of a crash). Current phase: **Fase 1 — rutinas y calendario semanal** (see `docs/MVP.md`) — add SQLite persistence and build the routine/weekly-schedule screens. Don't touch Fase 2+ (logging "Hoy", progress) until Fase 1's test criteria are met.

## Intended architecture

This is a personal physical-progress tracking app with two planned components:

- **`backend/`** — FastAPI (Python), SQLite, Pydantic for schemas. Structure is `app/routers/` (one module per resource, exports an `APIRouter`), `app/schemas/` (Pydantic models), `app/services/` (business logic) — not a single `main.py`. REST endpoints with explicit status codes and `HTTPException` error handling, pytest for non-trivial business logic.
- **`mobile/`** — Expo (React Native), TypeScript. Standard, well-documented Expo/RN patterns only — no exotic architectures or heavy state libraries (Redux etc.) until the project actually needs them; prefer `useState`/Context while small.
- iOS builds go through **EAS Build/Submit**, not local Xcode — the developer has an iPhone but no Mac, so the native build pipeline lives entirely in the cloud.

The backend defines the API contract; the mobile app consumes whatever shape the backend returns. Any change to that contract is a cross-cutting concern between the two sides.

## Local development

The mobile app runs on a physical iPhone via Expo Go, not a simulator. `localhost`/`127.0.0.1` in the mobile app will NOT reach a backend running on the developer's machine — use the machine's LAN IP (e.g. `192.168.x.x:8000`) as the API base URL, and keep phone and machine on the same Wi-Fi network.

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