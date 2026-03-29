# app/routers/partners.py
import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime, timezone

from app.database import get_db
from app.models.partner import PartnerRequest
from app.models.analyst import Analyst
from app.services.auth_service import get_current_analyst
from app.services.seed import seed_partners

router = APIRouter()

VALID_STATUSES = ["new", "under_review", "approved", "onboarded", "active", "rejected"]


class PartnerRequestCreate(BaseModel):
    company_name:       str
    institution_type:   str = ""
    contact_name:       str = ""
    contact_email:      str = ""
    transaction_volume: str = ""
    message:            str = ""


class StatusUpdate(BaseModel):
    status: str


# ── Public — called by the partner inquiry form ───────────────────────────────
@router.post("")
async def create_request(body: PartnerRequestCreate, db: AsyncSession = Depends(get_db)):
    req = PartnerRequest(
        id=f"PR-{uuid.uuid4().hex[:8].upper()}",
        company_name=body.company_name,
        institution_type=body.institution_type,
        contact_name=body.contact_name,
        contact_email=body.contact_email,
        transaction_volume=body.transaction_volume,
        message=body.message,
        status="new",
    )
    db.add(req)
    await db.commit()
    return {"success": True, "id": req.id}


# ── Admin — all requests ──────────────────────────────────────────────────────
@router.get("/requests")
async def list_requests(
    db: AsyncSession = Depends(get_db),
    _:  str = Depends(get_current_analyst),
):
    await seed_partners(db)
    result = await db.execute(select(PartnerRequest).order_by(PartnerRequest.created_at.desc()))
    rows = result.scalars().all()
    return [
        {
            "id":                 r.id,
            "company_name":       r.company_name,
            "institution_type":   r.institution_type or "",
            "contact_name":       r.contact_name or "",
            "contact_email":      r.contact_email or "",
            "transaction_volume": r.transaction_volume or "",
            "message":            r.message or "",
            "status":             r.status,
            "created_at":         r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


# ── Admin — active partners with analyst counts ───────────────────────────────
@router.get("")
async def list_active_partners(
    db: AsyncSession = Depends(get_db),
    _:  str = Depends(get_current_analyst),
):
    result = await db.execute(
        select(PartnerRequest)
        .where(PartnerRequest.status == "active")
        .order_by(PartnerRequest.company_name)
    )
    partners = result.scalars().all()

    out = []
    for p in partners:
        a_result = await db.execute(
            select(Analyst).where(
                Analyst.institution == p.company_name,
                Analyst.is_active == True,  # noqa: E712
            )
        )
        analysts = a_result.scalars().all()
        last_login = max((a.last_login for a in analysts if a.last_login), default=None)
        out.append({
            "id":               p.id,
            "company_name":     p.company_name,
            "institution_type": p.institution_type or "",
            "contact_email":    p.contact_email or "",
            "analyst_count":    len(analysts),
            "last_login":       last_login.isoformat() if last_login else None,
            "status":           p.status,
        })
    return out


# ── Admin — update pipeline status ───────────────────────────────────────────
@router.patch("/{request_id}/status")
async def update_status(
    request_id: str,
    body: StatusUpdate,
    db: AsyncSession = Depends(get_db),
    _:  str = Depends(get_current_analyst),
):
    if body.status not in VALID_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status. Valid values: {VALID_STATUSES}",
        )
    result = await db.execute(select(PartnerRequest).where(PartnerRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status_code=404, detail=f"Request {request_id} not found")

    req.status     = body.status
    req.updated_at = datetime.now(timezone.utc)
    await db.commit()
    return {"success": True, "id": request_id, "status": body.status}
