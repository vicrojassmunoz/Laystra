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
  main.py       # FastAPI app instance, mounts routers
  routers/      # one module per resource, each exports an APIRouter
  schemas/      # Pydantic request/response models
  services/     # business logic, kept out of routers
tests/
```
