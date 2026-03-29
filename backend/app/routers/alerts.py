# app/routers/alerts.py
import time as _time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_

from app.database import get_db
from app.models.alert import Alert
from app.schemas.schemas import AlertOut, AlertStatusUpdate, AlertImportRequest, AlertImportResponse
from app.services.auth_service import get_current_analyst, get_current_analyst_data
from app.services.seed import seed_alerts

router = APIRouter()

# Institutions that can see ALL data (super-user / demo / unassigned)
_SEE_ALL = {"", "Demo", "Inkingi Shield"}


def _row_to_dict(a: Alert) -> dict:
    """Map DB snake_case columns → camelCase keys the frontend expects."""
    return {
        "id":          a.id,
        "customer":    a.customer,
        "initials":    a.initials    or "",
        "score":       a.score,
        "level":       a.level       or "LOW",
        "amount":      a.amount      or "",
        "amountNum":   a.amount_num  or 0,
        "phone":       a.phone       or "",
        "email":       a.email       or "",
        "address":     a.address     or "",
        "device":      a.device      or "",
        "type":        a.type        or "",
        "time":        a.time        or "",
        "phoneRisk":   a.phone_risk  or "low",
        "emailRisk":   a.email_risk  or "low",
        "addressRisk": a.address_risk or "low",
        "deviceRisk":  a.device_risk  or "low",
        "status":      a.status,
        "reason":      a.reason      or "",
    }


@router.get("", response_model=list[AlertOut])
async def get_alerts(
    db:      AsyncSession = Depends(get_db),
    analyst: dict = Depends(get_current_analyst_data),
):
    await seed_alerts(db)
    q = select(Alert).order_by(Alert.created_at.desc())
    institution = analyst.get("institution", "")
    if institution not in _SEE_ALL:
        q = q.where(or_(Alert.institution == institution, Alert.institution.is_(None)))
    result = await db.execute(q)
    return [_row_to_dict(a) for a in result.scalars().all()]


@router.post("/import", response_model=AlertImportResponse)
async def import_alerts(
    body:    AlertImportRequest,
    db:      AsyncSession = Depends(get_db),
    analyst: dict = Depends(get_current_analyst_data),
):
    """Batch-import MoMo-scored alerts from the analyst's browser tool."""
    institution = analyst.get("institution", "")
    ts  = int(_time.time())
    ids = []
    for i, item in enumerate(body.alerts):
        alert_id = f"MoMo-{ts}-{i}"
        alert = Alert(
            id          = alert_id,
            customer    = item.customer,
            initials    = "".join(w[0].upper() for w in item.customer.split()[:2]),
            score       = item.score,
            level       = item.level,
            amount      = item.amount,
            amount_num  = item.amount_num,
            type        = item.type,
            time        = item.time or "just now",
            reason      = item.reason,
            status      = "pending",
            institution = institution or None,
        )
        db.add(alert)
        ids.append(alert_id)
    await db.commit()
    return AlertImportResponse(created=len(ids), ids=ids)


@router.patch("/{alert_id}")
async def update_alert_status(
    alert_id: str,
    body:     AlertStatusUpdate,
    db:       AsyncSession = Depends(get_db),
    _:        str = Depends(get_current_analyst),
):
    if body.status not in ("approved", "cancelled"):
        raise HTTPException(status_code=400, detail="status must be 'approved' or 'cancelled'")

    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert  = result.scalar_one_or_none()

    if not alert:
        raise HTTPException(status_code=404, detail=f"Alert {alert_id} not found")

    alert.status = body.status
    await db.commit()
    return {"success": True, "id": alert_id, "status": body.status}
