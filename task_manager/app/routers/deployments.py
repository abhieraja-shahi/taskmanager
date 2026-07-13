import os
import uuid
from datetime import date, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import get_current_user, require_manager
from app.models.bank import Bank
from app.models.deployment import Deployment, deployment_banks
from app.models.task import Task
from app.models.user import User
from app.schemas.deployment import DeploymentCreate, DeploymentResponse

router = APIRouter(prefix="/deployments", tags=["deployments"])

UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "uploads", "deployment_scripts",
)
MAX_FILE_SIZE = 25 * 1024 * 1024


def _base_query():
    return (
        select(Deployment)
        .options(
            selectinload(Deployment.deployed_by),
            selectinload(Deployment.banks),
            selectinload(Deployment.tasks),
        )
        .order_by(Deployment.created_at.desc())
    )


@router.get("/", response_model=List[DeploymentResponse])
async def list_deployments(
    software_version: Optional[str] = Query(None),
    bank_id: Optional[int] = Query(None),
    date_from: Optional[date] = Query(None),
    date_to: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_manager),
):
    q = _base_query()

    if software_version:
        q = q.where(Deployment.software_version == software_version)

    if bank_id:
        q = q.where(
            Deployment.id.in_(
                select(deployment_banks.c.deployment_id).where(
                    deployment_banks.c.bank_id == bank_id
                )
            )
        )

    if date_from:
        q = q.where(Deployment.created_at >= date_from)

    if date_to:
        q = q.where(Deployment.created_at < date_to + timedelta(days=1))

    result = await db.execute(q)
    return result.scalars().all()


@router.post("/", response_model=DeploymentResponse, status_code=201)
async def create_deployment(
    data: DeploymentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_manager),
):
    deployed_by_id = data.deployed_by_id or user.id
    if data.deployed_by_id and data.deployed_by_id != user.id:
        target = await db.get(User, data.deployed_by_id)
        if not target:
            raise HTTPException(404, "Specified user not found")
        deployed_by_id = target.id

    deployment = Deployment(
        artifact_type=data.artifact_type,
        software_version=data.software_version,
        name=data.name.strip(),
        purpose=data.purpose.strip(),
        deployed_by_id=deployed_by_id,
        deployed_at=data.deployed_at,
    )
    db.add(deployment)
    await db.flush()

    if data.bank_ids:
        banks = (await db.execute(select(Bank).where(Bank.id.in_(data.bank_ids)))).scalars().all()
        deployment.banks = banks

    if data.task_ids:
        tasks = (await db.execute(select(Task).where(Task.id.in_(data.task_ids)))).scalars().all()
        deployment.tasks = tasks

    await db.commit()

    result = await db.execute(_base_query().where(Deployment.id == deployment.id).order_by(None))
    return result.scalar_one()


@router.post("/{deployment_id}/script", response_model=DeploymentResponse)
async def upload_script(
    deployment_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_manager),
):
    deployment = await db.get(Deployment, deployment_id)
    if not deployment:
        raise HTTPException(404, "Deployment not found")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(413, "File too large. Maximum 25 MB.")

    if deployment.script_filepath and os.path.exists(deployment.script_filepath):
        os.remove(deployment.script_filepath)

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    unique_name = f"{uuid.uuid4().hex}_{file.filename}"
    filepath = os.path.join(UPLOAD_DIR, unique_name)
    with open(filepath, "wb") as f:
        f.write(contents)

    deployment.script_filename = file.filename
    deployment.script_filepath = filepath
    deployment.script_file_size = len(contents)
    deployment.script_content_type = file.content_type or "application/octet-stream"
    await db.commit()

    result = await db.execute(_base_query().where(Deployment.id == deployment_id).order_by(None))
    return result.scalar_one()


@router.get("/{deployment_id}/script/download")
async def download_script(
    deployment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    deployment = await db.get(Deployment, deployment_id)
    if not deployment:
        raise HTTPException(404, "Deployment not found")
    if not deployment.script_filepath or not os.path.exists(deployment.script_filepath):
        raise HTTPException(404, "No script file attached")
    return FileResponse(
        deployment.script_filepath,
        filename=deployment.script_filename,
        media_type=deployment.script_content_type,
    )


@router.delete("/{deployment_id}", status_code=204)
async def delete_deployment(
    deployment_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_manager),
):
    deployment = await db.get(Deployment, deployment_id)
    if not deployment:
        raise HTTPException(404, "Deployment not found")
    if deployment.script_filepath and os.path.exists(deployment.script_filepath):
        os.remove(deployment.script_filepath)
    await db.delete(deployment)
    await db.commit()
