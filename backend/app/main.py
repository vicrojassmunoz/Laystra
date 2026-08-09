from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import exercises, health, routines, schedule, today, workouts

app = FastAPI(title="Laystra API")

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
