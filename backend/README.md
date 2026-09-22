# Laystra backend

FastAPI backend for the Laystra workout-tracking app. See the repo root [`CLAUDE.md`](../CLAUDE.md) for project scope and architecture.

## Setup

```
uv sync
```

## Run

```
uv run uvicorn app.main:app --reload --host 0.0.0.0
```

`--host 0.0.0.0` is required: the Expo app on a physical iPhone reaches this over the LAN, not via `localhost`. With the server running, the phone (on the same Wi-Fi network) hits it at `http://<your-machine-LAN-IP>:8000`.

Check it's up:

```
curl http://127.0.0.1:8000/health
# {"status":"ok"}
```

## Test

```
uv run pytest
```

## Run in Docker (production)

Copy `.env.example` to `.env` and fill in `CLOUDFLARE_TUNNEL_TOKEN` (from the Cloudflare Zero Trust dashboard → Networks → Tunnels), then:

```
docker compose up -d
```

Brings up the backend plus `cloudflared`, which tunnels `https://laystra.vicrojas.com` to it — see `docs/ARCHITECTURE.md` → "Despliegue (Fase 4)" for the full shape and why a tunnel instead of port-forwarding. This is separate from local dev above; `uv run uvicorn ...` still works unchanged.

## Backup / restore (production SQLite)

`laystra.db` in Docker lives in the named volume `laystra-db`, not on the host filesystem. A naive `docker cp` of the live file can corrupt it; the scripts use SQLite's online backup API **inside** the `backend` container, then copy the snapshot out to OneDrive.

From `backend/`:

```
.\scripts\backup_db.ps1                  # snapshot → %OneDrive%\Laystra-backups\laystra-YYYY-MM-DD.db
.\scripts\backup_db.ps1 -VerifyOnly      # PRAGMA integrity_check + COUNT(workouts) on the latest copy
.\scripts\backup_db.ps1 -RegisterTask    # one-shot: Task Scheduler daily at 03:00 (you run this once)
.\scripts\restore_db.ps1 -BackupFile "$env:OneDrive\Laystra-backups\laystra-YYYY-MM-DD.db"
```

Retention is 14 days (older dated files in that folder are pruned). `-RegisterTask` creates a Windows task named `LaystraBackup`; confirm with `schtasks /Query /TN LaystraBackup /V /FO LIST`.

First restore drill: run `-VerifyOnly` against a copy. Do **not** point `restore_db.ps1` at production until you have a verified snapshot and actually need to roll back — restore stops the backend, overwrites `/data/laystra.db`, and starts it again.

On Linux later, the same Compose commands work from cron (`docker compose exec` → `docker compose cp`); only the Task Scheduler wrapper is Windows-specific.

## Structure

```
app/
  main.py       # FastAPI app instance, mounts routers, CORS
  routers/      # one module per resource, each exports an APIRouter
  schemas/      # Pydantic request/response models
  db.py         # SQLAlchemy engine, SessionLocal, get_db dependency
  models.py     # SQLAlchemy ORM models
  seed.py       # idempotent dev seed (only runs against an empty DB)
tests/
```

Persistence is SQLite (Fase 1) via SQLAlchemy — the database file is `laystra.db`, a sibling of `pyproject.toml`, gitignored via the root `.gitignore`'s `*.db` pattern. No migrations (Alembic) yet; tables are created with `Base.metadata.create_all` on startup.

Endpoints (see [`../docs/MVP.md`](../docs/MVP.md) for the full spec): `/health`, `/exercises` (+ `/exercises/{id}/progress`), `/routines`, `/schedule`, `/today`, `/workouts`. Full list at `/docs` while the server is running.

`GET /today` takes `date` as a **required** query param (`?date=YYYY-MM-DD`) — the client computes "today" locally and passes it, the server never guesses from its own clock. This matters now that the backend can be hosted somewhere with a different timezone than the phone (Fase 4).
