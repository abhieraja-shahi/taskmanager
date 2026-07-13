from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, require_admin
from app.models.bank import Bank
from app.models.user import User
from app.schemas.bank import BankCreate, BankUpdate, BankResponse

router = APIRouter(prefix="/banks", tags=["banks"])


@router.get("/", response_model=List[BankResponse])
async def list_banks(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    result = await db.execute(select(Bank).order_by(Bank.name))
    return result.scalars().all()


@router.post("/", response_model=BankResponse, status_code=201)
async def create_bank(
    data: BankCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    existing = await db.execute(select(Bank).where(Bank.name == data.name.strip()))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Bank with this name already exists")
    bank = Bank(name=data.name.strip())
    db.add(bank)
    await db.commit()
    await db.refresh(bank)
    return bank


@router.put("/{bank_id}", response_model=BankResponse)
async def update_bank(
    bank_id: int,
    data: BankUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    bank = await db.get(Bank, bank_id)
    if bank is None:
        raise HTTPException(status_code=404, detail="Bank not found")
    if data.name is not None:
        name = data.name.strip()
        existing = await db.execute(select(Bank).where(Bank.name == name, Bank.id != bank_id))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Bank with this name already exists")
        bank.name = name
    await db.commit()
    await db.refresh(bank)
    return bank


@router.delete("/{bank_id}", status_code=204)
async def delete_bank(
    bank_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(require_admin),
):
    bank = await db.get(Bank, bank_id)
    if bank is None:
        raise HTTPException(status_code=404, detail="Bank not found")
    await db.delete(bank)
    await db.commit()
