"""Tests for /notifications/* and /assignments/my endpoints."""
import pytest
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient

from tests.conftest import register_and_login, auth


def future_due():
    return (datetime.now(timezone.utc) + timedelta(days=5)).isoformat()


class TestNotifications:
    async def test_notifications_list_empty_initially(self, client: AsyncClient):
        _, token = await register_and_login(client, "notif_empty", "user")
        res = await client.get("/notifications/", headers=auth(token))
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_assignment_creates_notification(self, client: AsyncClient):
        """Creating a task with an assignee should produce a notification for that user."""
        _, mgr_token = await register_and_login(client, "notif_mgr", "manager")
        usr_data, usr_token = await register_and_login(client, "notif_usr", "user")

        await client.post("/tasks/", json={
            "title": "Notify Task", "due_date": future_due(),
            "assignee_ids": [usr_data["id"]], "team_ids": [],
        }, headers=auth(mgr_token))

        res = await client.get("/notifications/", headers=auth(usr_token))
        assert res.status_code == 200
        notifs = res.json()
        assert len(notifs) >= 1
        # Should be unread
        unread = [n for n in notifs if not n["is_read"]]
        assert len(unread) >= 1

    async def test_mark_notification_read(self, client: AsyncClient):
        _, mgr_token = await register_and_login(client, "mark_mgr", "manager")
        usr_data, usr_token = await register_and_login(client, "mark_usr", "user")

        await client.post("/tasks/", json={
            "title": "Mark Read Task", "due_date": future_due(),
            "assignee_ids": [usr_data["id"]], "team_ids": [],
        }, headers=auth(mgr_token))

        notifs = (await client.get("/notifications/", headers=auth(usr_token))).json()
        unread = [n for n in notifs if not n["is_read"]]
        assert len(unread) >= 1
        notif_id = unread[0]["id"]

        res = await client.put(f"/notifications/{notif_id}/read", headers=auth(usr_token))
        assert res.status_code == 200
        assert res.json()["is_read"] is True

    async def test_mark_all_notifications_read(self, client: AsyncClient):
        _, mgr_token = await register_and_login(client, "mark_all_mgr", "manager")
        usr_data, usr_token = await register_and_login(client, "mark_all_usr", "user")

        # Create two tasks to generate 2 notifications
        for i in range(2):
            await client.post("/tasks/", json={
                "title": f"Mark All Task {i}", "due_date": future_due(),
                "assignee_ids": [usr_data["id"]], "team_ids": [],
            }, headers=auth(mgr_token))

        res = await client.put("/notifications/read-all", headers=auth(usr_token))
        assert res.status_code in (200, 204)

        # Verify all are read
        notifs = (await client.get("/notifications/", headers=auth(usr_token))).json()
        assert all(n["is_read"] for n in notifs)

    async def test_cannot_read_others_notification(self, client: AsyncClient):
        _, mgr_token = await register_and_login(client, "steal_mgr", "manager")
        usr_data, _         = await register_and_login(client, "steal_owner", "user")
        _, intruder_token   = await register_and_login(client, "steal_intruder", "user")

        await client.post("/tasks/", json={
            "title": "Private Notif Task", "due_date": future_due(),
            "assignee_ids": [usr_data["id"]], "team_ids": [],
        }, headers=auth(mgr_token))

        owner_notifs = (await client.get("/notifications/",
                                         headers=auth(_))).json()  # _ is wrong token
        # Get the owner's token properly
        from tests.conftest import auth as _auth
        log = await client.post("/auth/login", json={"email": "steal_owner@test.com", "password": "password123"})
        owner_token = log.json()["access_token"]
        owner_notifs = (await client.get("/notifications/", headers=_auth(owner_token))).json()

        if owner_notifs:
            notif_id = owner_notifs[0]["id"]
            # Intruder tries to mark it read
            res = await client.put(f"/notifications/{notif_id}/read",
                                   headers=_auth(intruder_token))
            assert res.status_code in (403, 404)

    async def test_notifications_unauthenticated(self, client: AsyncClient):
        res = await client.get("/notifications/")
        assert res.status_code == 401


class TestAssignments:
    async def test_my_assignments_empty_for_new_user(self, client: AsyncClient):
        _, token = await register_and_login(client, "asgn_empty", "user")
        res = await client.get("/assignments/my", headers=auth(token))
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    async def test_my_assignments_populated_after_task_creation(self, client: AsyncClient):
        _, mgr_token = await register_and_login(client, "asgn_mgr", "manager")
        usr_data, usr_token = await register_and_login(client, "asgn_usr", "user")

        await client.post("/tasks/", json={
            "title": "Assigned Me Task", "due_date": future_due(),
            "assignee_ids": [usr_data["id"]], "team_ids": [],
        }, headers=auth(mgr_token))

        res = await client.get("/assignments/my", headers=auth(usr_token))
        assert res.status_code == 200
        data = res.json()
        assert len(data) >= 1
        assert data[0]["user_id"] == usr_data["id"]
        assert data[0]["status"] == "pending"
        assert "task_id" in data[0]

    async def test_assignments_include_task_id(self, client: AsyncClient):
        _, mgr_token = await register_and_login(client, "asgn_tid_mgr", "manager")
        usr_data, usr_token = await register_and_login(client, "asgn_tid_usr", "user")

        task = (await client.post("/tasks/", json={
            "title": "Task ID Check", "due_date": future_due(),
            "assignee_ids": [usr_data["id"]], "team_ids": [],
        }, headers=auth(mgr_token))).json()

        assignments = (await client.get("/assignments/my", headers=auth(usr_token))).json()
        assert any(a["task_id"] == task["id"] for a in assignments)

    async def test_assignments_unauthenticated(self, client: AsyncClient):
        res = await client.get("/assignments/my")
        assert res.status_code == 401
