import os
import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user
from app.models.attachment import TaskAttachment
from app.models.task import Task
from app.models.user import User, UserRole
from app.schemas.attachment import AttachmentResponse

router = APIRouter(tags=["attachments"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads")
MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB


@router.post("/tasks/{task_id}/attachments", response_model=AttachmentResponse, status_code=201)
async def upload_attachment(
    task_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(404, "Task not found")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large. Maximum size is 25 MB.")

    task_dir = os.path.join(UPLOAD_DIR, str(task_id))
    os.makedirs(task_dir, exist_ok=True)
    unique_name = f"{uuid.uuid4().hex}_{file.filename}"
    filepath = os.path.join(task_dir, unique_name)
    with open(filepath, "wb") as f:
        f.write(contents)

    attachment = TaskAttachment(
        task_id=task_id,
        filename=file.filename,
        filepath=filepath,
        file_size=len(contents),
        content_type=file.content_type or "application/octet-stream",
        uploaded_by=user.id,
    )
    db.add(attachment)
    await db.commit()
    await db.refresh(attachment)

    result = await db.execute(
        select(TaskAttachment)
        .options(selectinload(TaskAttachment.uploader))
        .where(TaskAttachment.id == attachment.id)
    )
    return result.scalar_one()


@router.get("/tasks/{task_id}/attachments", response_model=List[AttachmentResponse])
async def list_attachments(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TaskAttachment)
        .options(selectinload(TaskAttachment.uploader))
        .where(TaskAttachment.task_id == task_id)
        .order_by(TaskAttachment.uploaded_at.desc())
    )
    return result.scalars().all()


@router.get("/attachments/{attachment_id}/download")
async def download_attachment(
    attachment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attachment = await db.get(TaskAttachment, attachment_id)
    if not attachment:
        raise HTTPException(404, "Attachment not found")
    if not os.path.exists(attachment.filepath):
        raise HTTPException(404, "File not found on disk")
    return FileResponse(
        attachment.filepath,
        filename=attachment.filename,
        media_type=attachment.content_type,
    )


@router.delete("/attachments/{attachment_id}", status_code=204)
async def delete_attachment(
    attachment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    attachment = await db.get(TaskAttachment, attachment_id)
    if not attachment:
        raise HTTPException(404, "Attachment not found")
    if attachment.uploaded_by != user.id and user.role not in (UserRole.ADMIN.value, UserRole.MANAGER.value):
        raise HTTPException(403, "Not authorized to delete this attachment")
    if os.path.exists(attachment.filepath):
        os.remove(attachment.filepath)
    await db.delete(attachment)
    await db.commit()
