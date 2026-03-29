# app/routers/customers.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.database import get_db
from app.models.customer import Customer
from app.schemas.schemas import CustomerOut
from app.services.auth_service import get_current_analyst_data
from app.services.seed import seed_customers

router = APIRouter()

_SEE_ALL = {"", "Demo", "Inkingi Shield"}


@router.get("", response_model=list[CustomerOut])
async def get_customers(
    db:      AsyncSession = Depends(get_db),
    analyst: dict = Depends(get_current_analyst_data),
):
    await seed_customers(db)
    q = select(Customer).order_by(Customer.created_at.desc())
    institution = analyst.get("institution", "")
    if institution not in _SEE_ALL:
        q = q.where(or_(Customer.institution == institution, Customer.institution.is_(None)))
    result = await db.execute(q)
    rows   = result.scalars().all()
    return [
        CustomerOut(
            id=c.id, name=c.name, initials=c.initials or "",
            phone=c.phone or "", email=c.email or "",
            location=c.location or "", joined=c.joined or "",
            transactions=c.transactions or 0,
            totalVolume=c.total_volume or "",
            riskScore=c.risk_score or 0,
            status=c.status, flags=c.flags or 0,
        )
        for c in rows
    ]
