"""Tests for /auth/* endpoints."""
import pytest
from httpx import AsyncClient

from tests.conftest import register_and_login, auth


class TestRegister:
    async def test_register_success(self, client: AsyncClient):
        res = await client.post("/auth/register", json={
            "email": "new_reg@test.com",
            "username": "new_reg",
            "password": "secret123",
            "role": "user",
        })
        assert res.status_code == 201
        body = res.json()
        assert body["email"] == "new_reg@test.com"
        assert body["username"] == "new_reg"
        assert body["role"] == "user"
        assert body["is_active"] is True
        assert "hashed_password" not in body

    async def test_register_manager_role(self, client: AsyncClient):
        res = await client.post("/auth/register", json={
            "email": "mgr_reg@test.com",
            "username": "mgr_reg",
            "password": "secret123",
            "role": "manager",
        })
        assert res.status_code == 201
        assert res.json()["role"] == "manager"

    async def test_register_duplicate_email(self, client: AsyncClient):
        payload = {"email": "dup@test.com", "username": "dup1", "password": "x", "role": "user"}
        await client.post("/auth/register", json=payload)
        payload["username"] = "dup2"
        res = await client.post("/auth/register", json=payload)
        assert res.status_code == 400
        assert "email" in res.json()["detail"].lower()

    async def test_register_duplicate_username(self, client: AsyncClient):
        await client.post("/auth/register", json={
            "email": "uniq1@test.com", "username": "dupname", "password": "x", "role": "user"
        })
        res = await client.post("/auth/register", json={
            "email": "uniq2@test.com", "username": "dupname", "password": "x", "role": "user"
        })
        assert res.status_code == 400
        assert "username" in res.json()["detail"].lower()


class TestLogin:
    async def test_login_success(self, client: AsyncClient):
        await client.post("/auth/register", json={
            "email": "login_ok@test.com", "username": "login_ok",
            "password": "mypassword", "role": "user",
        })
        res = await client.post("/auth/login", json={
            "email": "login_ok@test.com", "password": "mypassword"
        })
        assert res.status_code == 200
        body = res.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"

    async def test_login_wrong_password(self, client: AsyncClient):
        await client.post("/auth/register", json={
            "email": "wrongpw@test.com", "username": "wrongpw",
            "password": "correct", "role": "user",
        })
        res = await client.post("/auth/login", json={
            "email": "wrongpw@test.com", "password": "wrong"
        })
        assert res.status_code == 401

    async def test_login_unknown_email(self, client: AsyncClient):
        res = await client.post("/auth/login", json={
            "email": "nobody@test.com", "password": "anything"
        })
        assert res.status_code == 401


class TestMe:
    async def test_me_returns_current_user(self, client: AsyncClient):
        _, token = await register_and_login(client, "me_test", "manager")
        res = await client.get("/auth/me", headers=auth(token))
        assert res.status_code == 200
        body = res.json()
        assert body["email"] == "me_test@test.com"
        assert body["role"] == "manager"

    async def test_me_unauthenticated(self, client: AsyncClient):
        res = await client.get("/auth/me")
        assert res.status_code == 401

    async def test_me_invalid_token(self, client: AsyncClient):
        res = await client.get("/auth/me", headers={"Authorization": "Bearer invalid.token.here"})
        assert res.status_code == 401
