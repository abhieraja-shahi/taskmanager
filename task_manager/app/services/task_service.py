from datetime import datetime, timezone
from typing import List, Set

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.bank import Bank, task_banks
from app.models.comment import Comment
from app.models.task import Task, TaskStatus
from app.models.task_assignment import TaskAssignment, AssignmentStatus
from app.models.team import Team, TeamMember, TeamManager
from app.models.user import User, UserRole
from app.schemas.task import TaskUpdateSchema
from app.services.activity_service import log_activity
from app.services.notification_service import notify


class TaskService:

    async def _get_managed_user_ids(self, db: AsyncSession, manager_id: int) -> Set[int]:
        result = await db.execute(
            select(TeamMember.user_id)
            .join(Team, TeamMember.team_id == Team.id)
            .join(TeamManager, Team.id == TeamManager.team_id)
            .where(TeamManager.user_id == manager_id)
        )
        return {row[0] for row in result}

    async def create_task(self, db: AsyncSession, data, creator: User) -> Task:
        assignee_ids: set = set(data.assignee_ids)
        if data.team_ids:
            result = await db.execute(
                select(TeamMember).where(TeamMember.team_id.in_(data.team_ids))
            )
            for member in result.scalars().all():
                assignee_ids.add(member.user_id)

        if not assignee_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one assignee or team member is required",
            )

        # Validate dates
        now = datetime.now(timezone.utc)
        due = data.due_date
        start = getattr(data, 'start_date', None)
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        if due <= now:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Due date must be after the creation date",
            )
        if start is not None:
            if start.tzinfo is None:
                start = start.replace(tzinfo=timezone.utc)
            if due <= start:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Due date must be after the start date",
                )

        # Managers can only assign tasks to users in their managed teams (or themselves)
        if creator.role == UserRole.MANAGER.value:
            managed_ids = await self._get_managed_user_ids(db, creator.id)
            managed_ids.add(creator.id)
            invalid = assignee_ids - managed_ids
            if invalid:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Managers can only assign tasks to members of their own teams",
                )

        task = Task(
            title=data.title,
            description=data.description,
            due_date=data.due_date,
            start_date=getattr(data, 'start_date', None),
            created_by=creator.id,
            status=TaskStatus.PENDING_ACCEPTANCE.value,
            zammad_ticket_id=getattr(data, 'zammad_ticket_id', None),
        )
        db.add(task)
        await db.flush()

        for user_id in assignee_ids:
            db.add(TaskAssignment(task_id=task.id, user_id=user_id))

        if data.bank_ids:
            await db.execute(
                task_banks.insert(),
                [{"task_id": task.id, "bank_id": bid} for bid in data.bank_ids]
            )

        await log_activity(db, task.id, creator.id, "TASK_CREATED",
                           detail=f"Assigned to {len(assignee_ids)} user(s)")
        await notify("ASSIGNED", task, user_ids=list(assignee_ids), db=db)
        await db.commit()

        return await self._load_task(db, task.id)

    async def update_task(self, db: AsyncSession, task_id: int, data: TaskUpdateSchema, manager: User) -> Task:
        result = await db.execute(
            select(Task).options(selectinload(Task.banks)).where(Task.id == task_id)
        )
        task = result.scalar_one_or_none()
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        if task.status == TaskStatus.APPROVED.value:
            raise HTTPException(status_code=400, detail="Cannot edit a completed task")

        if data.title is not None:
            task.title = data.title
        if data.description is not None:
            task.description = data.description

        # Resolve effective due_date and start_date for validation
        new_due = data.due_date if data.due_date is not None else task.due_date
        new_start = data.start_date if data.start_date is not None else task.start_date
        if new_due is not None:
            if new_due.tzinfo is None:
                new_due = new_due.replace(tzinfo=timezone.utc)
            created = task.created_at
            if created.tzinfo is None:
                created = created.replace(tzinfo=timezone.utc)
            if new_due <= created:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Due date must be after the creation date",
                )
            if new_start is not None:
                if new_start.tzinfo is None:
                    new_start = new_start.replace(tzinfo=timezone.utc)
                if new_due <= new_start:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Due date must be after the start date",
                    )

        if data.due_date is not None:
            task.due_date = data.due_date
        if data.start_date is not None:
            task.start_date = data.start_date

        if data.bank_ids is not None:
            if data.bank_ids:
                result = await db.execute(select(Bank).where(Bank.id.in_(data.bank_ids)))
                banks = result.scalars().all()
                task.banks = list(banks)
            else:
                task.banks = []

        await log_activity(db, task_id, manager.id, "TASK_UPDATED", detail="Task details updated")
        await db.commit()
        return await self._load_task(db, task_id)

    async def reassign_task(self, db: AsyncSession, task_id: int, assignee_ids: List[int], manager: User) -> Task:
        task = await db.get(Task, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        if task.status == TaskStatus.APPROVED.value:
            raise HTTPException(status_code=400, detail="Cannot reassign a completed task")

        if not assignee_ids:
            raise HTTPException(status_code=400, detail="At least one assignee is required")

        # Manager scope check
        if manager.role == UserRole.MANAGER.value:
            managed_ids = await self._get_managed_user_ids(db, manager.id)
            managed_ids.add(manager.id)
            invalid = set(assignee_ids) - managed_ids
            if invalid:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Managers can only assign tasks to members of their own teams",
                )

        # Get existing assignments
        result = await db.execute(select(TaskAssignment).where(TaskAssignment.task_id == task_id))
        existing = result.scalars().all()
        existing_by_user = {a.user_id: a for a in existing}

        new_ids = set(assignee_ids)
        existing_ids = set(existing_by_user.keys())

        # Remove only pending assignments not in new list
        for user_id, assignment in existing_by_user.items():
            if user_id not in new_ids and assignment.status == AssignmentStatus.PENDING.value:
                await db.delete(assignment)

        # Add new assignments for users not already assigned
        added_ids = []
        for user_id in new_ids - existing_ids:
            db.add(TaskAssignment(task_id=task_id, user_id=user_id))
            added_ids.append(user_id)

        await log_activity(db, task_id, manager.id, "TASK_REASSIGNED",
                           detail=f"Assignees updated: {len(new_ids)} assignee(s)")
        if added_ids:
            await notify("ASSIGNED", task, user_ids=added_ids, db=db)
        await db.commit()
        return await self._load_task(db, task_id)

    async def accept_task(self, db: AsyncSession, task_id: int, user_id: int) -> Task:
        assignment = await self._get_assignment(db, task_id, user_id)
        if assignment.status != AssignmentStatus.PENDING.value:
            raise HTTPException(status_code=400, detail="Assignment is not in pending state")

        assignment.status = AssignmentStatus.ACCEPTED.value
        assignment.accepted_at = datetime.now(timezone.utc)

        task = await db.get(Task, task_id)
        if task.status == TaskStatus.PENDING_ACCEPTANCE.value:
            task.status = TaskStatus.IN_PROGRESS.value
            task.started_at = datetime.now(timezone.utc)

        await log_activity(db, task_id, user_id, "TASK_ACCEPTED")
        await notify("ACCEPTED", task, manager_ids=[task.created_by], db=db)
        await db.commit()

        return await self._load_task(db, task_id)

    async def reject_task(self, db: AsyncSession, task_id: int, user_id: int, reason: str) -> Task:
        assignment = await self._get_assignment(db, task_id, user_id)
        if assignment.status != AssignmentStatus.PENDING.value:
            raise HTTPException(status_code=400, detail="Assignment is not in pending state")

        assignment.status = AssignmentStatus.REJECTED.value
        assignment.rejection_reason = reason

        task = await db.get(Task, task_id)
        await log_activity(db, task_id, user_id, "TASK_REJECTED", detail=reason)
        await notify("REJECTED", task, manager_ids=[task.created_by], db=db, reason=reason)
        await db.commit()

        return await self._load_task(db, task_id)

    async def complete_task_by_user(self, db: AsyncSession, task_id: int, user_id: int) -> Task:
        assignment = await self._get_assignment(db, task_id, user_id)
        if assignment.status != AssignmentStatus.ACCEPTED.value:
            raise HTTPException(status_code=400, detail="Task must be accepted before marking ready for review")

        assignment.status = AssignmentStatus.COMPLETED.value
        assignment.completed_at = datetime.now(timezone.utc)
        await db.flush()

        result = await db.execute(
            select(TaskAssignment).where(
                TaskAssignment.task_id == task_id,
                TaskAssignment.status != AssignmentStatus.REJECTED.value,
            )
        )
        active = result.scalars().all()
        all_done = all(a.status == AssignmentStatus.COMPLETED.value for a in active)

        task = await db.get(Task, task_id)
        if all_done:
            task.status = TaskStatus.UNDER_REVIEW.value
            task.completed_at = datetime.now(timezone.utc)
            await notify("UNDER_REVIEW", task, manager_ids=[task.created_by], db=db)

        await log_activity(db, task_id, user_id, "READY_FOR_REVIEW")
        await db.commit()

        return await self._load_task(db, task_id)

    async def manager_review(
        self,
        db: AsyncSession,
        task_id: int,
        manager_id: int,
        approved: bool,
        comment: str = None,
    ) -> Task:
        task = await db.get(Task, task_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        if task.status != TaskStatus.UNDER_REVIEW.value:
            raise HTTPException(status_code=400, detail="Task is not under review")

        result = await db.execute(
            select(TaskAssignment).where(TaskAssignment.task_id == task_id)
        )
        all_assignments = result.scalars().all()
        assignee_ids = [a.user_id for a in all_assignments]

        task.reviewed_by = manager_id

        if approved:
            task.status = TaskStatus.APPROVED.value
            action = "TASK_COMPLETED"
            await notify("APPROVED", task, user_ids=assignee_ids, db=db)
        else:
            task.status = TaskStatus.IN_PROGRESS.value
            task.completed_at = None
            for a in all_assignments:
                if a.status == AssignmentStatus.COMPLETED.value:
                    a.status = AssignmentStatus.ACCEPTED.value
                    a.completed_at = None
            action = "REVIEW_REJECTED"
            if comment:
                db.add(Comment(task_id=task_id, user_id=manager_id, content=comment))
            await notify(
                "REVIEW_REJECTED", task,
                user_ids=assignee_ids, db=db,
                comment=comment or "(no comment)",
            )

        await log_activity(db, task_id, manager_id, action, detail=comment)
        await db.commit()

        return await self._load_task(db, task_id)

    async def _get_assignment(self, db: AsyncSession, task_id: int, user_id: int) -> TaskAssignment:
        result = await db.execute(
            select(TaskAssignment).where(
                TaskAssignment.task_id == task_id,
                TaskAssignment.user_id == user_id,
            )
        )
        assignment = result.scalar_one_or_none()
        if assignment is None:
            raise HTTPException(status_code=404, detail="Assignment not found for this user")
        return assignment

    async def _get_all_assignments(self, db: AsyncSession, task_id: int) -> List[TaskAssignment]:
        result = await db.execute(
            select(TaskAssignment).where(TaskAssignment.task_id == task_id)
        )
        return result.scalars().all()

    async def _load_task(self, db: AsyncSession, task_id: int) -> Task:
        result = await db.execute(
            select(Task)
            .options(
                selectinload(Task.assignments).selectinload(TaskAssignment.user),
                selectinload(Task.comments).selectinload(Comment.user),
                selectinload(Task.creator),
                selectinload(Task.reviewer),
                selectinload(Task.banks),
            )
            .where(Task.id == task_id)
        )
        task = result.scalar_one_or_none()
        if task is None:
            raise HTTPException(status_code=404, detail="Task not found")
        return task
