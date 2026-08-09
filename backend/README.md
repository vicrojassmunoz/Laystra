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

## Structure

```
app/
  main.py       # FastAPI app instance, mounts routers, CORS
  routers/      # one module per resource, each exports an APIRouter
  schemas/      # Pydantic request/response models
  services/
    store.py    # Fase 0 in-memory data store (seeded, resets on restart) — SQLite lands in Fase 1
tests/
```

Endpoints (see [`../docs/MVP.md`](../docs/MVP.md) for the full spec): `/health`, `/exercises` (+ `/exercises/{id}/progress`), `/routines`, `/schedule`, `/today`, `/workouts`. Full list at `/docs` while the server is running.

`GET /today` takes `date` as a **required** query param (`?date=YYYY-MM-DD`) — the client computes "today" locally and passes it, the server never guesses from its own clock. This matters once the backend is hosted somewhere with a different timezone than the phone (Fase 4).
