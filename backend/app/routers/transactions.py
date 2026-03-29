# app/routers/transactions.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.database import get_db
from app.models.transaction import Transaction
from app.schemas.schemas import TransactionOut
from app.services.auth_service import get_current_analyst_data
from app.services.seed import seed_transactions

router = APIRouter()

_SEE_ALL = {"", "Demo", "Inkingi Shield"}


@router.get("", response_model=list[TransactionOut])
async def get_transactions(
    db:      AsyncSession = Depends(get_db),
    analyst: dict = Depends(get_current_analyst_data),
):
    await seed_transactions(db)
    q = select(Transaction).order_by(Transaction.created_at.desc())
    institution = analyst.get("institution", "")
    if institution not in _SEE_ALL:
        q = q.where(or_(Transaction.institution == institution, Transaction.institution.is_(None)))
    result = await db.execute(q)
    txns   = result.scalars().all()
    return [
        TransactionOut(
            id=t.id, customer=t.customer, amount=t.amount,
            type=t.type, date=t.date, score=t.score,
            status=t.status, channel=t.channel,
        )
        for t in txns
    ]
