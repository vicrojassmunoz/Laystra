from fastapi import FastAPI

from app.routers import health

app = FastAPI(title="Laystra API")

app.include_router(health.router)
