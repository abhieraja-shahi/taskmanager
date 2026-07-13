"""
Run this once to create the initial admin account:
    python create_admin.py
"""
import asyncio
from passlib.context import CryptContext
from sqlalchemy import select
from app.database import AsyncSessionLocal
from app.models import *  # noqa: F401 — ensures all models are registered
from app.models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ADMIN_EMAIL = "admin@etherealinformatics.com"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "sipl123"  # change this


async def main():
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == ADMIN_EMAIL))
        if existing.scalar_one_or_none():
            print("Admin already exists.")
            return

        admin = User(
            email=ADMIN_EMAIL,
            username=ADMIN_USERNAME,
            hashed_password=pwd_context.hash(ADMIN_PASSWORD),
            role="admin",
        )
        db.add(admin)
        await db.commit()
        print(f"Admin created — email: {ADMIN_EMAIL}, password: {ADMIN_PASSWORD}")


asyncio.run(main())
