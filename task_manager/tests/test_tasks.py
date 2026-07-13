"""
Tests for task CRUD and the full 7-state lifecycle:
  PENDING_ACCEPTANCE → IN_PROGRESS → UNDER_REVIEW → APPROVED
  and the rejection / re-open path.
"""
import itertools
import pytest
from datetime import datetime, timedelta, timezone
from httpx import AsyncClient

from tests.conftest import register_and_login, auth

# Unique counter so fixtures never collide on the same email
_counter = itertools.count(1)


def future_due():
    return (datetime.now(timezone.utc) + timedelta(days=7)).isoformat()


async def make_manager_and_user(client, prefix):
    """Helper: create a manager + a user, return (mgr_token, usr_data, usr_token)."""
    n = next(_counter)
    _, mgr_token = await register_and_login(client, f"{prefix}_mgr_{n}", "manager")
    usr_data, usr_token = await register_and_login(client, f"{prefix}_usr_{n}", "user")
    return mgr_token, usr_data, usr_token


class TestTaskCRUD:
    async def test_create_task_as_manager(self, client: AsyncClient):
        mgr_token, usr_data, _ = await make_manager_and_user(client, "crud")
        res = await client.post("/tasks/", json={
            "title": "Test Task Alpha",
            "description": "Some details",
            "due_date": future_due(),
            "assignee_ids": [usr_data["id"]],
            "team_ids": [],
        }, headers=auth(mgr_token))
        assert res.status_code == 201, res.text
        body = res.json()
        assert body["title"] == "Test Task Alpha"
        assert body["status"] == "pending_acceptance"
        assert "id" in body

    async def test_create_task_forbidden_for_user(self, client: AsyncClient):
        n = next(_counter)
        _, usr_token = await register_and_login(client, f"deny_usr_{n}", "user")
        _, mgr_token = await register_and_login(client, f"deny_mgr_{n}", "manager")
        usr2, _ = await register_and_login(client, f"deny_usr2_{n}", "user")
        res = await client.post("/tasks/", json={
            "title": "Forbidden", "due_date": future_due(),
            "assignee_ids": [usr2["id"]], "team_ids": [],
        }, headers=auth(usr_token))
        assert res.status_code == 403

    async def test_list_tasks(self, client: AsyncClient):
        mgr_token, usr_data, _ = await make_manager_and_user(client, "list")
        for i in range(2):
            r = await client.post("/tasks/", json={
                "title": f"List Task {i}", "due_date": future_due(),
                "assignee_ids": [usr_data["id"]], "team_ids": [],
            }, headers=auth(mgr_token))
            assert r.status_code == 201, r.text
        res = await client.get("/tasks/", headers=auth(mgr_token))
        assert res.status_code == 200
        assert len(res.json()) >= 2

    async def test_get_task(self, client: AsyncClient):
        mgr_token, usr_data, _ = await make_manager_and_user(client, "get")
        create = await client.post("/tasks/", json={
            "title": "Get Me", "due_date": future_due(),
            "assignee_ids": [usr_data["id"]], "team_ids": [],
        }, headers=auth(mgr_token))
        assert create.status_code == 201, create.text
        task_id = create.json()["id"]
        res = await client.get(f"/tasks/{task_id}", headers=auth(mgr_token))
        assert res.status_code == 200
        assert res.json()["id"] == task_id

    async def test_get_task_not_found(self, client: AsyncClient):
        n = next(_counter)
        _, token = await register_and_login(client, f"notfound_{n}", "user")
        res = await client.get("/tasks/999999", headers=auth(token))
        assert res.status_code == 404

    async def test_create_task_with_assignee(self, client: AsyncClient):
        mgr_token, usr_data, _ = await make_manager_and_user(client, "assign")
        res = await client.post("/tasks/", json={
            "title": "Assigned Task",
            "due_date": future_due(),
            "assignee_ids": [usr_data["id"]],
            "team_ids": [],
        }, headers=auth(mgr_token))
        assert res.status_code == 201, res.text
        body = res.json()
        assert len(body["assignments"]) == 1
        assert body["assignments"][0]["user_id"] == usr_data["id"]
        assert body["assignments"][0]["status"] == "pending"

    async def test_task_requires_assignee_or_team(self, client: AsyncClient):
        mgr_token, _, _ = await make_manager_and_user(client, "noassign")
        res = await client.post("/tasks/", json={
            "title": "No Assignee", "due_date": future_due(),
            "assignee_ids": [], "team_ids": [],
        }, headers=auth(mgr_token))
        assert res.status_code == 400


class TestTaskLifecycle:
    """Full happy path: create → accept → complete → review(approve) → APPROVED."""

    @pytest.fixture
    async def lifecycle_task(self, client: AsyncClient):
        mgr_token, usr_data, usr_token = await make_manager_and_user(client, "lc")
        res = await client.post("/tasks/", json={
            "title": "Lifecycle Task",
            "due_date": future_due(),
            "assignee_ids": [usr_data["id"]],
            "team_ids": [],
        }, headers=auth(mgr_token))
        assert res.status_code == 201, res.text
        return res.json(), mgr_token, usr_token

    async def test_accept_task(self, client: AsyncClient, lifecycle_task):
        task, mgr_token, usr_token = lifecycle_task
        res = await client.post(f"/tasks/{task['id']}/accept", headers=auth(usr_token))
        assert res.status_code == 200
        assert res.json()["status"] == "in_progress"

    async def test_complete_task(self, client: AsyncClient, lifecycle_task):
        task, mgr_token, usr_token = lifecycle_task
        await client.post(f"/tasks/{task['id']}/accept",   headers=auth(usr_token))
        res = await client.post(f"/tasks/{task['id']}/complete", headers=auth(usr_token))
        assert res.status_code == 200
        assert res.json()["status"] == "under_review"

    async def test_approve_task(self, client: AsyncClient, lifecycle_task):
        task, mgr_token, usr_token = lifecycle_task
        await client.post(f"/tasks/{task['id']}/accept",   headers=auth(usr_token))
        await client.post(f"/tasks/{task['id']}/complete", headers=auth(usr_token))
        res = await client.post(f"/tasks/{task['id']}/review",
                                json={"approved": True, "comment": "Looks good!"},
                                headers=auth(mgr_token))
        assert res.status_code == 200
        assert res.json()["status"] == "approved"

    async def test_reject_review_returns_to_in_progress(self, client: AsyncClient, lifecycle_task):
        task, mgr_token, usr_token = lifecycle_task
        await client.post(f"/tasks/{task['id']}/accept",   headers=auth(usr_token))
        await client.post(f"/tasks/{task['id']}/complete", headers=auth(usr_token))
        res = await client.post(f"/tasks/{task['id']}/review",
                                json={"approved": False, "comment": "Needs fixes"},
                                headers=auth(mgr_token))
        assert res.status_code == 200
        assert res.json()["status"] == "in_progress"

    async def test_reject_assignment(self, client: AsyncClient):
        mgr_token, usr_data, usr_token = await make_manager_and_user(client, "rej")
        create = await client.post("/tasks/", json={
            "title": "Rejectable Task", "due_date": future_due(),
            "assignee_ids": [usr_data["id"]], "team_ids": [],
        }, headers=auth(mgr_token))
        assert create.status_code == 201, create.text
        task_id = create.json()["id"]

        res = await client.post(f"/tasks/{task_id}/reject",
                                json={"reason": "I am too busy"},
                                headers=auth(usr_token))
        assert res.status_code == 200
        my = next(a for a in res.json()["assignments"] if a["user_id"] == usr_data["id"])
        assert my["status"] == "rejected"
        assert my["rejection_reason"] == "I am too busy"

    async def test_accept_wrong_user_forbidden(self, client: AsyncClient):
        mgr_token, usr_data, _ = await make_manager_and_user(client, "wrongacc")
        n = next(_counter)
        _, other_tok = await register_and_login(client, f"wrongacc_other_{n}", "user")
        create = await client.post("/tasks/", json={
            "title": "Not Yours", "due_date": future_due(),
            "assignee_ids": [usr_data["id"]], "team_ids": [],
        }, headers=auth(mgr_token))
        assert create.status_code == 201
        task_id = create.json()["id"]
        res = await client.post(f"/tasks/{task_id}/accept", headers=auth(other_tok))
        assert res.status_code in (403, 404)

    async def test_review_forbidden_for_plain_user(self, client: AsyncClient):
        mgr_token, usr_data, usr_token = await make_manager_and_user(client, "revforbid")
        create = await client.post("/tasks/", json={
            "title": "Review Gated", "due_date": future_due(),
            "assignee_ids": [usr_data["id"]], "team_ids": [],
        }, headers=auth(mgr_token))
        assert create.status_code == 201
        task_id = create.json()["id"]
        await client.post(f"/tasks/{task_id}/accept",   headers=auth(usr_token))
        await client.post(f"/tasks/{task_id}/complete", headers=auth(usr_token))
        res = await client.post(f"/tasks/{task_id}/review",
                                json={"approved": True}, headers=auth(usr_token))
        assert res.status_code == 403


class TestComments:
    async def test_add_and_list_comments(self, client: AsyncClient):
        mgr_token, usr_data, usr_token = await make_manager_and_user(client, "cmt")
        create = await client.post("/tasks/", json={
            "title": "Comment Task", "due_date": future_due(),
            "assignee_ids": [usr_data["id"]], "team_ids": [],
        }, headers=auth(mgr_token))
        assert create.status_code == 201, create.text
        task_id = create.json()["id"]

        add = await client.post(f"/tasks/{task_id}/comments",
                                json={"content": "First comment!"},
                                headers=auth(usr_token))
        assert add.status_code == 201
        assert add.json()["content"] == "First comment!"

        lst = await client.get(f"/tasks/{task_id}/comments", headers=auth(usr_token))
        assert lst.status_code == 200
        assert any(c["content"] == "First comment!" for c in lst.json())

    async def test_add_comment_unauthenticated(self, client: AsyncClient):
        mgr_token, usr_data, _ = await make_manager_and_user(client, "cmt_unauth")
        create = await client.post("/tasks/", json={
            "title": "Auth Comment Task", "due_date": future_due(),
            "assignee_ids": [usr_data["id"]], "team_ids": [],
        }, headers=auth(mgr_token))
        assert create.status_code == 201, create.text
        task_id = create.json()["id"]
        res = await client.post(f"/tasks/{task_id}/comments", json={"content": "No auth"})
        assert res.status_code == 401


class TestActivityLog:
    async def test_activity_log_after_accept(self, client: AsyncClient):
        mgr_token, usr_data, usr_token = await make_manager_and_user(client, "act")
        create = await client.post("/tasks/", json={
            "title": "Activity Task", "due_date": future_due(),
            "assignee_ids": [usr_data["id"]], "team_ids": [],
        }, headers=auth(mgr_token))
        assert create.status_code == 201, create.text
        task_id = create.json()["id"]
        await client.post(f"/tasks/{task_id}/accept", headers=auth(usr_token))

        res = await client.get(f"/tasks/{task_id}/activity", headers=auth(usr_token))
        assert res.status_code == 200
        actions = [entry["action"] for entry in res.json()]
        assert any("accept" in a.lower() or "created" in a.lower() for a in actions)
