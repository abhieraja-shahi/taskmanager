"""Tests for /teams/* endpoints."""
import itertools
import pytest
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient

from tests.conftest import register_and_login, auth

_counter = itertools.count(1)


class TestTeamCRUD:
    async def test_create_team_as_manager(self, client: AsyncClient):
        n = next(_counter)
        _, token = await register_and_login(client, f"team_mgr_{n}", "manager")
        res = await client.post("/teams/", json={"name": f"Backend Team {n}", "member_ids": []},
                                headers=auth(token))
        assert res.status_code == 201
        body = res.json()
        assert body["name"] == f"Backend Team {n}"
        assert "id" in body
        assert body["members"] == []

    async def test_create_team_forbidden_for_user(self, client: AsyncClient):
        n = next(_counter)
        _, token = await register_and_login(client, f"team_usr_deny_{n}", "user")
        res = await client.post("/teams/", json={"name": f"Forbidden Team {n}", "member_ids": []},
                                headers=auth(token))
        assert res.status_code == 403

    async def test_list_teams(self, client: AsyncClient):
        n = next(_counter)
        _, token = await register_and_login(client, f"list_team_mgr_{n}", "manager")
        await client.post("/teams/", json={"name": f"List Team A {n}", "member_ids": []},
                          headers=auth(token))
        res = await client.get("/teams/", headers=auth(token))
        assert res.status_code == 200
        assert isinstance(res.json(), list)
        names = [t["name"] for t in res.json()]
        assert f"List Team A {n}" in names

    async def test_list_teams_as_regular_user(self, client: AsyncClient):
        n = next(_counter)
        _, token = await register_and_login(client, f"list_team_usr_{n}", "user")
        res = await client.get("/teams/", headers=auth(token))
        assert res.status_code == 200

    async def test_create_team_with_members(self, client: AsyncClient):
        n = next(_counter)
        _, mgr_token = await register_and_login(client, f"wm_mgr_{n}", "manager")
        usr_data, _ = await register_and_login(client, f"wm_usr_{n}", "user")
        res = await client.post("/teams/", json={
            "name": f"Team With Members {n}",
            "member_ids": [usr_data["id"]],
        }, headers=auth(mgr_token))
        assert res.status_code == 201
        assert len(res.json()["members"]) == 1
        assert res.json()["members"][0]["user_id"] == usr_data["id"]


class TestTeamMembers:
    async def test_add_members(self, client: AsyncClient):
        n = next(_counter)
        _, mgr_token = await register_and_login(client, f"add_mem_mgr_{n}", "manager")
        usr_data, _ = await register_and_login(client, f"add_mem_usr_{n}", "user")

        team = (await client.post("/teams/", json={"name": f"Grow Team {n}", "member_ids": []},
                                  headers=auth(mgr_token))).json()
        res = await client.post(f"/teams/{team['id']}/members",
                                json={"user_ids": [usr_data["id"]]},
                                headers=auth(mgr_token))
        assert res.status_code == 200
        member_ids = [m["user_id"] for m in res.json()["members"]]
        assert usr_data["id"] in member_ids

    async def test_remove_member(self, client: AsyncClient):
        n = next(_counter)
        _, mgr_token = await register_and_login(client, f"rm_mem_mgr_{n}", "manager")
        usr_data, _ = await register_and_login(client, f"rm_mem_usr_{n}", "user")

        team = (await client.post("/teams/", json={
            "name": f"Shrink Team {n}", "member_ids": [usr_data["id"]]
        }, headers=auth(mgr_token))).json()

        res = await client.delete(f"/teams/{team['id']}/members/{usr_data['id']}",
                                  headers=auth(mgr_token))
        # DELETE endpoint returns 204 No Content
        assert res.status_code == 204

    async def test_add_members_forbidden_for_user(self, client: AsyncClient):
        n = next(_counter)
        _, mgr_token = await register_and_login(client, f"add_forbid_mgr_{n}", "manager")
        usr_data, usr_token = await register_and_login(client, f"add_forbid_usr_{n}", "user")

        team = (await client.post("/teams/", json={"name": f"Guard Team {n}", "member_ids": []},
                                  headers=auth(mgr_token))).json()
        res = await client.post(f"/teams/{team['id']}/members",
                                json={"user_ids": [usr_data["id"]]},
                                headers=auth(usr_token))
        assert res.status_code == 403

    async def test_task_assigned_via_team(self, client: AsyncClient):
        """Creating a task with team_ids should create per-user assignments."""
        n = next(_counter)
        due = (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()

        _, mgr_token = await register_and_login(client, f"team_task_mgr_{n}", "manager")
        usr1, _ = await register_and_login(client, f"team_task_u1_{n}", "user")
        usr2, _ = await register_and_login(client, f"team_task_u2_{n}", "user")

        team = (await client.post("/teams/", json={
            "name": f"Task Team {n}",
            "member_ids": [usr1["id"], usr2["id"]],
        }, headers=auth(mgr_token))).json()

        task = (await client.post("/tasks/", json={
            "title": f"Team Task {n}",
            "due_date": due,
            "assignee_ids": [],
            "team_ids": [team["id"]],
        }, headers=auth(mgr_token))).json()

        assert task["status"] == "pending_acceptance"
        user_ids = [a["user_id"] for a in task["assignments"]]
        assert usr1["id"] in user_ids
        assert usr2["id"] in user_ids
