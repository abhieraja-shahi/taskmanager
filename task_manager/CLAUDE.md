# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Tech Stack

- **FastAPI** — web framework
- **SQLAlchemy 2 (async)** — ORM via `sqlalchemy.ext.asyncio`
- **MySQL** — database (async: `aiomysql`, sync: `pymysql`)
- **Pydantic v2 / pydantic-settings** — validation and config
- **JWT (python-jose) + passlib[bcrypt]** — authentication
- **Celery + Redis** — background jobs (broker: `redis://localhost:6379/0`)
- **Alembic** — database migrations (uses sync engine)

## Running

```bash
pip install -r requirements.txt

# API server
uvicorn app.main:app --reload

# Celery worker
celery -A app.workers.celery_tasks worker --loglevel=info

# Celery beat scheduler (due-date reminders, runs daily at 8 AM UTC)
celery -A app.workers.celery_tasks beat --loglevel=info
```

## Database Migrations

```bash
alembic upgrade head
alembic revision --autogenerate -m "description"
```

`.env` must contain `DATABASE_URL` (async), `SYNC_DATABASE_URL` (sync), and `SECRET_KEY`.

## Architecture

### Task Lifecycle (7 states)

```
PENDING_ACCEPTANCE ──accept──► IN_PROGRESS ──all users complete──► UNDER_REVIEW ──approve──► APPROVED
                   ──reject──► (stays rejected)                                  ──reject──► IN_PROGRESS
                                                                                              (assignments reset to ACCEPTED)
```

- `started_at` is logged on first acceptance.
- `completed_at` is logged when all non-rejected assignees mark complete.
- Team assignment expands `team_ids` → per-user `TaskAssignment` rows at creation time.

### Key Modules

| Path | Role |
|------|------|
| `app/services/task_service.py` | All lifecycle business logic; `_load_task()` always returns tasks with `selectinload(assignments, comments)` |
| `app/services/activity_service.py` | `log_activity()` — call before `db.commit()`, uses `flush()` internally |
| `app/services/notification_service.py` | `notify()` async (pass `db=` to persist to DB); `send_reminder_notification()` sync (for Celery) |
| `app/routers/tasks.py` | Task lifecycle endpoints + comments + activity log |
| `app/routers/dashboard.py` | Manager dashboard (filters: status, user_id, team_id, date range); user dashboard (active + overdue) |
| `app/routers/teams.py` | Team CRUD, member management |
| `app/routers/notifications.py` | Read/mark-read notifications |
| `app/workers/celery_tasks.py` | `check_due_dates` task: DUE_SOON (within 24h) and OVERDUE alerts |
| `app/models/__init__.py` | **Imports all models** — this file must be imported before SQLAlchemy resolves `relationship()` string refs |
| `app/main.py` | `import app.models` at top triggers relationship resolution at startup |
| `app/dependencies.py` | `get_current_user`, `require_manager`, `require_admin` |

### Role System

- `admin` — sees all tasks in manager dashboard; can create tasks/teams
- `manager` — sees own tasks in manager dashboard; can create tasks/teams, review completions
- `user` — can accept/reject/complete assigned tasks, add comments

### Import Order (no circular imports)

```
config → database → models/* → models/__init__ → schemas/* → dependencies → services/* → routers/* → main
```

All SQLAlchemy `relationship()` declarations use string names (`"TaskAssignment"`, `"User"`, etc.) — never direct class imports between model files.

### Notification Persistence

`notify()` stores a `Notification` row per recipient when called with `db=`. All task service methods pass `db=` so notifications are stored. The `/notifications/` endpoint lets users poll their notifications.

## API Endpoints Summary

| Method | Path | Auth |
|--------|------|------|
| POST | `/auth/register` | admin |
| GET | `/auth/users` | admin |
| GET | `/auth/users/search?q=` | manager/admin |
| PUT | `/auth/users/{id}/role` | admin |
| DELETE | `/auth/users/{id}` | admin |
| POST | `/auth/login` | public |
| POST | `/tasks/` | manager/admin |
| GET | `/tasks/` | manager/admin |
| GET | `/tasks/{id}` | any user |
| POST | `/tasks/{id}/accept` | assigned user |
| POST | `/tasks/{id}/reject` | assigned user |
| POST | `/tasks/{id}/complete` | assigned user |
| POST | `/tasks/{id}/review` | manager/admin |
| POST | `/tasks/{id}/comments` | any user |
| GET | `/tasks/{id}/comments` | any user |
| GET | `/tasks/{id}/activity` | any user |
| GET | `/dashboard/manager` | manager/admin |
| GET | `/dashboard/user` | any user |
| GET | `/teams/` | any user |
| POST | `/teams/` | manager/admin |
| POST | `/teams/{id}/managers` | admin |
| DELETE | `/teams/{id}/managers/{uid}` | admin |
| DELETE | `/teams/{id}` | admin |
| POST | `/teams/{id}/members` | manager/admin |
| DELETE | `/teams/{id}/members/{uid}` | manager/admin |
| GET | `/activity/` | manager/admin |
| GET | `/assignments/my` | any user |
| GET | `/notifications/` | any user |
| PUT | `/notifications/{id}/read` | any user |
| PUT | `/notifications/read-all` | any user |
