from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings

# Import all models to register them with SQLAlchemy's mapper before first request.
# This resolves all relationship() string references (e.g. "TaskAssignment", "User").
import app.models  # noqa: F401

from app.routers import activity, assignments, attachments, auth, banks, dashboard, deployments, notifications, tasks, teams, zammad

app = FastAPI(title="Task Manager API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(attachments.router)
app.include_router(banks.router)
app.include_router(tasks.router)
app.include_router(assignments.router)
app.include_router(teams.router)
app.include_router(dashboard.router)
app.include_router(notifications.router)
app.include_router(activity.router)
app.include_router(zammad.router)
app.include_router(deployments.router)


@app.get("/health", tags=["health"])
async def health():
    return {"status": "ok"}
