# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ethereal Task Tracker is a three-component system: a FastAPI backend (`task_manager/`), a React frontend (`frontend/`), and a Flask webhook receiver (`Webhook/`) that ingests Zammad helpdesk tickets into the same MySQL database.

## Development Commands

### Backend (task_manager/)
```bash
cd task_manager
pip install -r requirements.txt
uvicorn app.main:app --reload                                    # API on :8000
celery -A app.workers.celery_tasks worker --loglevel=info        # background jobs
celery -A app.workers.celery_tasks beat --loglevel=info           # scheduled tasks
alembic upgrade head                                              # run migrations
alembic revision --autogenerate -m "description"                  # create migration
```

### Frontend (frontend/)
```bash
cd frontend
npm install
npm run dev      # Vite dev server on :5173, proxies API calls to :8000
npm run build    # production build
```

### Webhook (Webhook/)
```bash
cd Webhook
pip install -r requirements.txt
python app.py    # Flask on :5050
```

## Architecture

### Three Services, One Database
- **task_manager** (FastAPI, async SQLAlchemy + aiomysql) — core API for tasks, users, teams, notifications
- **frontend** (React 18 + Vite) — SPA that proxies all API routes to the backend via `vite.config.js`
- **Webhook** (Flask, sync SQLAlchemy + pymysql) — receives Zammad webhook POSTs, upserts into `zammad_tickets` table; shares the same `.env` as `task_manager/`

### Backend Architecture (task_manager/)
See `task_manager/CLAUDE.md` for detailed module descriptions, task lifecycle states, role system, and full API endpoint listing.

Key points:
- **Import order** matters: `config → database → models/* → models/__init__ → schemas → dependencies → services → routers → main`. All `relationship()` declarations use string names to avoid circular imports.
- **`app/models/__init__.py`** must be imported before SQLAlchemy resolves relationships — `app/main.py` does this at startup.
- **`.env`** requires `DATABASE_URL` (async mysql+aiomysql), `SYNC_DATABASE_URL` (sync mysql+pymysql), and `SECRET_KEY`.
- **Task lifecycle**: `PENDING_ACCEPTANCE → IN_PROGRESS → UNDER_REVIEW → APPROVED` (with reject paths).
- **Roles**: `admin` (full access), `manager` (own tasks + review), `user` (accept/reject/complete assigned tasks).

### Frontend Architecture (frontend/)
- React Router v6 with lazy-loaded pages and three route guards: `RequireAuth`, `RequireManager`, `RequireAdmin`
- `AuthContext` handles JWT token storage and role checks (`isManager`, `isAdmin`)
- `ToastContext` provides app-wide toast notifications
- Vite proxy config in `vite.config.js` forwards `/auth`, `/tasks`, `/teams`, `/dashboard`, `/notifications`, `/assignments`, `/activity`, `/zammad`, `/health` to the backend

### Webhook Architecture (Webhook/)
See `Webhook/CLAUDE.md` for details. Flow: Flask receives POST → `ticket_parser.py` converts to dataclasses → `ticket_handler.py` processes → `db.py` upserts to MySQL. Uses `X-Zammad-Trigger` header for routing (not payload body).

## Environment

- Python 3.14, Node.js
- MySQL database (shared between task_manager and Webhook)
- Redis required for Celery broker (`redis://localhost:6379/0`)
