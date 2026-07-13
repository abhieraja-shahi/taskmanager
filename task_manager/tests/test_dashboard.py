"""Tests for /dashboard/* endpoints."""
import itertools
import pytest
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient

from tests.conftest import register_and_login, auth

_counter = itertools.count(1)


def future_due():
    return (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()


async def setup_mgr_and_user(client, prefix):
    n = next(_counter)
    _, mgr_token = await register_and_login(client, f"{prefix}_mgr_{n}", "manager")
    usr_data, usr_token = await register_and_login(client, f"{prefix}_usr_{n}", "user")
    return mgr_token, usr_data, usr_token, n


class TestManagerDashboard:
    async def test_manager_sees_own_tasks(self, client: AsyncClient):
        mgr_token, usr_data, _, n = await setup_mgr_and_user(client, "dash")
        r = await client.post("/tasks/", json={
            "title": f"Dashboard Task {n}", "due_date": future_due(),
            "assignee_ids": [usr_data["id"]], "team_ids": [],
        }, headers=auth(mgr_token))
        assert r.status_code == 201, r.text

        res = await client.get("/dashboard/manager", headers=auth(mgr_token))
        assert res.status_code == 200
        titles = [t["title"] for t in res.json()]
        assert f"Dashboard Task {n}" in titles

    async def test_manager_dashboard_status_filter(self, client: AsyncClient):
        mgr_token, usr_data, _, n = await setup_mgr_and_user(client, "dash_filter")
        r = await client.post("/tasks/", json={
            "title": f"Pending Task {n}", "due_date": future_due(),
            "assignee_ids": [usr_data["id"]], "team_ids": [],
        }, headers=auth(mgr_token))
        assert r.status_code == 201, r.text

        res = await client.get("/dashboard/manager?status=pending_acceptance",
                               headers=auth(mgr_token))
        assert res.status_code == 200
        for task in res.json():
            assert task["status"] == "pending_acceptance"

    async def test_manager_dashboard_forbidden_for_user(self, client: AsyncClient):
        n = next(_counter)
        _, usr_token = await register_and_login(client, f"dash_usr_deny_{n}", "user")
        res = await client.get("/dashboard/manager", headers=auth(usr_token))
        assert res.status_code == 403

    async def test_manager_dashboard_unauthenticated(self, client: AsyncClient):
        res = await client.get("/dashboard/manager")
        assert res.status_code == 401

    async def test_manager_does_not_see_others_tasks(self, client: AsyncClient):
        mgr_a_token, usr_a, _, na = await setup_mgr_and_user(client, "dashA")
        mgr_b_token, usr_b, _, nb = await setup_mgr_and_user(client, "dashB")

        r = await client.post("/tasks/", json={
            "title": f"Manager B Task {nb}", "due_date": future_due(),
            "assignee_ids": [usr_b["id"]], "team_ids": [],
        }, headers=auth(mgr_b_token))
        assert r.status_code == 201, r.text

        res = await client.get("/dashboard/manager", headers=auth(mgr_a_token))
        assert res.status_code == 200
        titles = [t["title"] for t in res.json()]
        assert f"Manager B Task {nb}" not in titles


class TestUserDashboard:
    async def test_user_sees_assigned_tasks(self, client: AsyncClient):
        mgr_token, usr_data, usr_token, n = await setup_mgr_and_user(client, "udash")
        r = await client.post("/tasks/", json={
            "title": f"My Task {n}", "due_date": future_due(),
            "assignee_ids": [usr_data["id"]], "team_ids": [],
        }, headers=auth(mgr_token))
        assert r.status_code == 201, r.text

        res = await client.get("/dashboard/user", headers=auth(usr_token))
        assert res.status_code == 200
        titles = [t["title"] for t in res.json()]
        assert f"My Task {n}" in titles

    async def test_user_does_not_see_unassigned_tasks(self, client: AsyncClient):
        mgr_token, usr_a, _, na = await setup_mgr_and_user(client, "udash2")
        # Create a second (unrelated) user
        nb = next(_counter)
        usr_b, usr_b_token = await register_and_login(client, f"udash2_other_{nb}", "user")

        r = await client.post("/tasks/", json={
            "title": f"Not Assigned {na}", "due_date": future_due(),
            "assignee_ids": [usr_a["id"]], "team_ids": [],
        }, headers=auth(mgr_token))
        assert r.status_code == 201, r.text

        res = await client.get("/dashboard/user", headers=auth(usr_b_token))
        assert res.status_code == 200
        titles = [t["title"] for t in res.json()]
        assert f"Not Assigned {na}" not in titles

    async def test_user_dashboard_unauthenticated(self, client: AsyncClient):
        res = await client.get("/dashboard/user")
        assert res.status_code == 401

    async def test_manager_can_also_access_user_dashboard(self, client: AsyncClient):
        n = next(_counter)
        _, mgr_token = await register_and_login(client, f"mgr_udash_{n}", "manager")
        res = await client.get("/dashboard/user", headers=auth(mgr_token))
        assert res.status_code == 200
