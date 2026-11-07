import sqlite3

from sqlalchemy import create_engine

from app.db import _add_missing_columns

D = "2026-11-07"


# ---------- Workout.duration_seconds ----------


def _workout(**extra):
    return {"date": D, "sets": [{"exercise_id": 1, "weight": 50, "reps": 5, "order": 0}], **extra}


def test_workout_duration_roundtrip(client):
    created = client.post("/workouts", json=_workout(duration_seconds=3600))
    assert created.status_code == 201
    assert created.json()["duration_seconds"] == 3600
    wid = created.json()["id"]
    assert client.get(f"/workouts/{wid}").json()["duration_seconds"] == 3600
    assert client.get("/workouts").json()[0]["duration_seconds"] == 3600

    updated = client.put(f"/workouts/{wid}", json=_workout(duration_seconds=90))
    assert updated.json()["duration_seconds"] == 90
    # PUT es reemplazo total: omitirlo lo deja a null
    assert client.put(f"/workouts/{wid}", json=_workout()).json()["duration_seconds"] is None


def test_workout_duration_defaults_null_and_rejects_negative(client):
    assert client.post("/workouts", json=_workout()).json()["duration_seconds"] is None
    assert client.post("/workouts", json=_workout(duration_seconds=-1)).status_code == 422


def test_duration_column_added_idempotently_to_old_db(tmp_path):
    path = tmp_path / "old.db"
    con = sqlite3.connect(path)
    con.execute("CREATE TABLE workouts (id INTEGER PRIMARY KEY, date DATE, routine_id INTEGER, notes TEXT)")
    con.execute("INSERT INTO workouts (date) VALUES ('2026-01-01')")
    con.commit()
    con.close()
    eng = create_engine(f"sqlite:///{path}")
    _add_missing_columns(eng)
    _add_missing_columns(eng)
    con = sqlite3.connect(path)
    cols = [r[1] for r in con.execute("PRAGMA table_info(workouts)")]
    assert cols.count("duration_seconds") == 1
    assert con.execute("SELECT duration_seconds FROM workouts").fetchone() == (None,)
    con.close()
    eng.dispose()


# ---------- Injuries ----------

INJ = {"title": "Tendinitis", "body_area": "rodilla", "severity": "leve", "since": "2026-10-01"}


def test_injury_crud(client):
    r = client.post("/injuries", json={**INJ, "title": "  Tendinitis  ", "notes": "  "})
    assert r.status_code == 201
    body = r.json()
    assert body == {"id": body["id"], **INJ, "active": True, "notes": None}
    iid = body["id"]

    assert client.get(f"/injuries/{iid}").json()["title"] == "Tendinitis"
    put = client.put(f"/injuries/{iid}", json={**INJ, "active": False, "severity": "grave", "notes": "x"})
    assert put.status_code == 200
    assert put.json()["active"] is False and put.json()["severity"] == "grave"

    client.post("/injuries", json=INJ)
    assert len(client.get("/injuries").json()) == 2
    assert [i["id"] for i in client.get("/injuries?active=true").json()] != [iid]
    assert [i["id"] for i in client.get("/injuries?active=false").json()] == [iid]

    assert client.delete(f"/injuries/{iid}").status_code == 204
    assert client.get(f"/injuries/{iid}").status_code == 404


def test_injury_validation_and_404(client):
    assert client.post("/injuries", json={**INJ, "body_area": "dedo"}).status_code == 422
    assert client.post("/injuries", json={**INJ, "severity": "mortal"}).status_code == 422
    assert client.post("/injuries", json={**INJ, "title": "   "}).status_code == 422
    assert client.post("/injuries", json={**INJ, "since": "ayer"}).status_code == 422
    assert client.put("/injuries/999", json=INJ).status_code == 404
    assert client.delete("/injuries/999").status_code == 404
    assert client.get("/injuries/999").status_code == 404


# ---------- Steps ----------


def test_steps_upsert_keeps_max(client):
    assert client.put(f"/steps/{D}", json={"steps": 5000}).json() == {"date": D, "steps": 5000}
    assert client.put(f"/steps/{D}", json={"steps": 3000}).json()["steps"] == 5000
    assert client.put(f"/steps/{D}", json={"steps": 7000}).json()["steps"] == 7000
    assert client.put(f"/steps/{D}", json={"steps": 7000}).json()["steps"] == 7000


def test_steps_validation(client):
    assert client.put(f"/steps/{D}", json={"steps": -1}).status_code == 422
    assert client.put(f"/steps/{D}", json={}).status_code == 422
    assert client.put("/steps/not-a-date", json={"steps": 1}).status_code == 422
    assert client.get("/steps?days=0").status_code == 422
    assert client.get("/steps?days=91").status_code == 422


def test_steps_list_fills_zero_days_most_recent_first(client):
    client.put("/steps/2026-11-07", json={"steps": 100})
    client.put("/steps/2026-11-05", json={"steps": 300})
    client.put("/steps/2026-10-01", json={"steps": 999})  # fuera de ventana
    r = client.get("/steps?days=3&end=2026-11-07")
    assert r.status_code == 200
    assert r.json() == [
        {"date": "2026-11-07", "steps": 100},
        {"date": "2026-11-06", "steps": 0},
        {"date": "2026-11-05", "steps": 300},
    ]
    assert len(client.get("/steps").json()) == 7


# ---------- Habits ----------


def test_builtin_habits_seeded_once(client):
    first = client.get("/habits").json()
    assert [(h["kind"], h["name"]) for h in first] == [("water", "Agua"), ("steps", "Pasos")]
    assert first[1]["target"] == 8000
    assert client.get("/habits").json() == first  # idempotente, sin duplicados


def test_habit_crud_and_validation(client):
    r = client.post(
        "/habits",
        json={"name": " Creatina ", "kind": "check", "reminder_time": "09:00", "position": 5},
    )
    assert r.status_code == 201
    h = r.json()
    assert h["name"] == "Creatina" and h["active"] is True and h["target"] is None
    hid = h["id"]

    put = client.put(f"/habits/{hid}", json={**{k: v for k, v in h.items() if k != "id"}, "name": "Creatina 5g"})
    assert put.status_code == 200 and put.json()["name"] == "Creatina 5g"
    assert client.get(f"/habits/{hid}").json()["name"] == "Creatina 5g"

    assert client.post("/habits", json={"name": "x", "kind": "check", "reminder_time": "25:00"}).status_code == 422
    assert client.post("/habits", json={"name": "x", "kind": "check", "reminder_time": "9:00"}).status_code == 422
    assert client.post("/habits", json={"name": "x", "kind": "count", "target": 0}).status_code == 422
    assert client.post("/habits", json={"name": " ", "kind": "check"}).status_code == 422
    assert client.post("/habits", json={"name": "x", "kind": "otro"}).status_code == 422
    # no se puede duplicar un integrado ni cambiar el kind
    assert client.post("/habits", json={"name": "Agua2", "kind": "water"}).status_code == 409
    assert client.put(f"/habits/{hid}", json={"name": "x", "kind": "count"}).status_code == 409

    assert client.delete(f"/habits/{hid}").status_code == 204
    assert client.get(f"/habits/{hid}").status_code == 404
    assert client.put("/habits/999", json={"name": "x", "kind": "check"}).status_code == 404
    assert client.delete("/habits/999").status_code == 404


def test_integrated_habits_cannot_be_deleted_or_logged(client):
    water, steps = client.get("/habits").json()
    assert client.delete(f"/habits/{water['id']}").status_code == 409
    assert client.delete(f"/habits/{steps['id']}").status_code == 409
    r = client.put(f"/habits/{steps['id']}/log", json={"date": D, "value": 1})
    assert r.status_code == 409
    # desactivar sí se puede
    body = {k: v for k, v in steps.items() if k != "id"} | {"active": False, "target": 10000}
    assert client.put(f"/habits/{steps['id']}", json=body).json()["target"] == 10000


def test_habits_today_water_and_steps_derived(client):
    client.post("/water/entries", json={"date": D, "ml": 1000})
    client.post("/water/entries", json={"date": D, "ml": 500})
    client.post("/water/entries", json={"date": "2026-11-06", "ml": 9999})
    client.put("/water/settings", json={"goal_ml": 3000})
    client.put(f"/steps/{D}", json={"steps": 8500})

    items = client.get(f"/habits/today?date={D}").json()
    by_kind = {i["habit"]["kind"]: i for i in items}
    assert by_kind["water"]["progress"] == 1500
    assert by_kind["water"]["target"] == 3000
    assert by_kind["water"]["done"] is False
    assert by_kind["steps"]["progress"] == 8500
    assert by_kind["steps"]["target"] == 8000
    assert by_kind["steps"]["done"] is True
    assert set(by_kind["water"]) == {"habit", "progress", "target", "done"}

    # otro día sin datos: progreso 0
    other = {i["habit"]["kind"]: i for i in client.get("/habits/today?date=2026-01-01").json()}
    assert other["steps"]["progress"] == 0 and other["steps"]["done"] is False


def test_habits_today_requires_date_and_skips_inactive(client):
    assert client.get("/habits/today").status_code == 422
    h = client.post("/habits", json={"name": "Estirar", "kind": "check", "active": False}).json()
    kinds = [i["habit"]["id"] for i in client.get(f"/habits/today?date={D}").json()]
    assert h["id"] not in kinds


def test_habit_log_check_and_count(client):
    check = client.post("/habits", json={"name": "Creatina", "kind": "check"}).json()
    count = client.post("/habits", json={"name": "Café", "kind": "count", "target": 3, "unit": "tazas"}).json()

    r = client.put(f"/habits/{check['id']}/log", json={"date": D, "value": 1})
    assert r.status_code == 200
    assert r.json()["progress"] == 1 and r.json()["target"] == 1 and r.json()["done"] is True
    # upsert: desmarcar sobrescribe, no duplica
    r = client.put(f"/habits/{check['id']}/log", json={"date": D, "value": 0})
    assert r.json()["progress"] == 0 and r.json()["done"] is False
    assert client.put(f"/habits/{check['id']}/log", json={"date": D, "value": 2}).status_code == 422

    client.put(f"/habits/{count['id']}/log", json={"date": D, "value": 2})
    r = client.put(f"/habits/{count['id']}/log", json={"date": D, "value": 3})
    assert r.json()["progress"] == 3 and r.json()["done"] is True
    assert client.put(f"/habits/{count['id']}/log", json={"date": D, "value": -1}).status_code == 422
    assert client.put("/habits/999/log", json={"date": D, "value": 1}).status_code == 404

    today = {i["habit"]["id"]: i for i in client.get(f"/habits/today?date={D}").json()}
    assert today[count["id"]]["progress"] == 3
    assert today[check["id"]]["progress"] == 0


def test_deleting_habit_removes_its_logs(client):
    h = client.post("/habits", json={"name": "Creatina", "kind": "check"}).json()
    client.put(f"/habits/{h['id']}/log", json={"date": D, "value": 1})
    assert client.delete(f"/habits/{h['id']}").status_code == 204
    # recrear no hereda logs huérfanos (ids sqlite pueden reutilizarse)
    h2 = client.post("/habits", json={"name": "Otra", "kind": "check"}).json()
    today = {i["habit"]["id"]: i for i in client.get(f"/habits/today?date={D}").json()}
    assert today[h2["id"]]["progress"] == 0


def test_check_and_water_reject_target(client):
    assert client.post("/habits", json={"name": "x", "kind": "check", "target": 1}).status_code == 422
    assert client.post("/habits", json={"name": "x", "kind": "water", "target": 2000}).status_code == 422
    assert client.post("/habits", json={"name": "x", "kind": "count", "target": 3}).status_code == 201
    h = client.post("/habits", json={"name": "x", "kind": "check", "target": None}).json()
    body = {k: v for k, v in h.items() if k != "id"} | {"target": 2}
    assert client.put(f"/habits/{h['id']}", json=body).status_code == 422
    water = client.get("/habits").json()[0]
    body = {k: v for k, v in water.items() if k != "id"} | {"target": 5}
    assert client.put(f"/habits/{water['id']}", json=body).status_code == 422


def test_ensure_builtin_habits_tolerates_race(client):
    from app import models
    from app.services.habits import ensure_builtin_habits
    from tests.conftest import TestingSessionLocal

    other = TestingSessionLocal()
    other.add(models.Habit(name="Agua", kind="water", unit="ml", position=0))
    other.commit()
    other.close()

    db = TestingSessionLocal()

    class StaleSession:
        """Su primer query() no ve el water ya insertado (simula la carrera)."""

        def __init__(self) -> None:
            self.stale = True

        def query(self, *args):
            if self.stale:
                self.stale = False
                return db.query(models.Habit.kind).filter(models.Habit.id < 0)
            return db.query(*args)

        def __getattr__(self, name):
            return getattr(db, name)

    ensure_builtin_habits(StaleSession())  # no debe lanzar IntegrityError
    kinds = sorted(k for (k,) in db.query(models.Habit.kind))
    db.close()
    assert kinds == ["steps", "water"]  # sin duplicar water, steps sembrado


def test_builtin_habit_unique_index_blocks_duplicates(client):
    from sqlalchemy.exc import IntegrityError

    from app import models
    from tests.conftest import TestingSessionLocal

    client.get("/habits")
    db = TestingSessionLocal()
    db.add(models.Habit(name="Agua2", kind="water"))
    try:
        db.commit()
        raised = False
    except IntegrityError:
        raised = True
    db.close()
    assert raised


def test_steps_habit_null_target_uses_default(client):
    from app import models
    from app.services.habits import DEFAULT_STEPS_TARGET, resolve_progress
    from tests.conftest import TestingSessionLocal

    client.get(f"/habits/today?date={D}")  # siembra integrados
    db = TestingSessionLocal()
    steps = db.query(models.Habit).filter(models.Habit.kind == "steps").one()
    steps.target = None
    db.commit()
    day = __import__("datetime").date.fromisoformat(D)

    client.put(f"/steps/{D}", json={"steps": 100})
    assert resolve_progress(db, steps, day) == (100.0, DEFAULT_STEPS_TARGET, False)
    client.put(f"/steps/{D}", json={"steps": 8000})
    assert resolve_progress(db, steps, day) == (8000.0, DEFAULT_STEPS_TARGET, True)
    db.close()

    by_kind = {i["habit"]["kind"]: i for i in client.get(f"/habits/today?date={D}").json()}
    assert by_kind["steps"]["target"] == 8000 and by_kind["steps"]["done"] is True


def test_count_null_target_done_when_progress_positive(client):
    h = client.post("/habits", json={"name": "Café", "kind": "count"}).json()
    r = client.put(f"/habits/{h['id']}/log", json={"date": D, "value": 0})
    assert r.json()["target"] is None and r.json()["done"] is False
    r = client.put(f"/habits/{h['id']}/log", json={"date": D, "value": 1})
    assert r.json()["target"] is None and r.json()["done"] is True
