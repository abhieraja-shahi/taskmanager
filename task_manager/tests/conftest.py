"""
Test configuration – uses an in-memory SQLite database so no MySQL connection
is required.  All app dependencies that touch the DB are overridden here.
"""
import os

# Must be set BEFORE any app import so pydantic-settings picks them up.
os.environ.setdefault("DATABASE_URL",      "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SYNC_DATABASE_URL", "sqlite:///./test_sync.db")
os.environ.setdefault("SECRET_KEY",        "test-secret-key-not-for-production")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "60")

# ── Passlib + bcrypt >= 4.0 compatibility fix ──────────────────────────────
# passlib 1.7.x calls detect_wrap_bug() which passes passwords > 72 bytes to
# bcrypt.hashpw(); bcrypt 4.0+ raises ValueError instead of silently truncating.
# Patching detect_wrap_bug to return False (no wrap bug — correct for bcrypt 4+)
# avoids the crash without affecting actual password hashing.
try:
    import passlib.handlers.bcrypt as _pb
    _pb.detect_wrap_bug = lambda _: False
    # Also suppress the missing __about__ warning
    import bcrypt as _bcrypt
    if not hasattr(_bcrypt, '__about__'):
        class _About:
            __version__ = _bcrypt.__version__
        _bcrypt.__about__ = _About
except Exception:
    pass

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.database import Base, get_db

# ── In-memory SQLite engine shared across the whole session ────────────────
_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    poolclass=StaticPool,          # all connections share the same DB
    connect_args={"check_same_thread": False},
)
_Session = async_sessionmaker(_engine, expire_on_commit=False)


async def _override_get_db():
    async with _Session() as session:
        yield session


app.dependency_overrides[get_db] = _override_get_db


# ── Create tables once for the entire test session ─────────────────────────
@pytest_asyncio.fixture(scope="session", autouse=True)
async def _create_tables():
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await _engine.dispose()


# ── Per-test async HTTP client ─────────────────────────────────────────────
@pytest_asyncio.fixture
async def client() -> AsyncClient:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


# ── Convenience helpers ────────────────────────────────────────────────────
async def register_and_login(client: AsyncClient, suffix: str, role: str = "user"):
    """Register a new user and return (user_data, token)."""
    reg = await client.post("/auth/register", json={
        "email":    f"{suffix}@test.com",
        "username": f"user_{suffix}",
        "password": "password123",
        "role":     role,
    })
    assert reg.status_code == 201, reg.text

    log = await client.post("/auth/login", json={
        "email":    f"{suffix}@test.com",
        "password": "password123",
    })
    assert log.status_code == 200, log.text
    token = log.json()["access_token"]
    return reg.json(), token


def auth(token: str) -> dict:
    """Return Authorization header dict."""
    return {"Authorization": f"Bearer {token}"}
