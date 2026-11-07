from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db import SessionLocal, init_db
from app.routers import (
    analytics,
    body_metrics,
    exercises,
    goals,
    habits,
    health,
    injuries,
    routines,
    schedule,
    steps,
    today,
    water,
    workouts,
)
from app.seed import seed_if_empty
from app.services.habits import ensure_builtin_habits


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None]:
    init_db()
    db = SessionLocal()
    try:
        seed_if_empty(db)
        ensure_builtin_habits(db)
    finally:
        db.close()
    yield


app = FastAPI(title="Laystra API", lifespan=lifespan)

# Wildcard is fine here: single-user personal app, no auth, LAN-only for now.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(exercises.router)
app.include_router(routines.router)
app.include_router(schedule.router)
app.include_router(today.router)
app.include_router(workouts.router)
app.include_router(body_metrics.router)
app.include_router(goals.router)
app.include_router(analytics.router)
app.include_router(water.router)
app.include_router(injuries.router)
app.include_router(habits.router)
app.include_router(steps.router)
