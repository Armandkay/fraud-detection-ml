# app/routers/analysts.py
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models.analyst import Analyst
from app.schemas.schemas import FaceDescriptorUpdate
from app.services.auth_service import get_current_analyst
from app.services.seed import seed_analysts

router = APIRouter()


class AnalystCreate(BaseModel):
    id:          str
    name:        str
    role:        str = "Fraud Analyst"
    institution: str = ""
    email:       str = ""


@router.get("")
async def list_analysts(
    db: AsyncSession = Depends(get_db),
    _:  str = Depends(get_current_analyst),
):
    await seed_analysts(db)
    result = await db.execute(select(Analyst).order_by(Analyst.created_at))
    rows   = result.scalars().all()
    return [
        {
            "id":            a.id,
            "name":          a.name,
            "role":          a.role,
            "institution":   a.institution or "",
            "email":         a.email or "",
            "is_active":     a.is_active,
            "last_login":    a.last_login.isoformat() if a.last_login else None,
            "face_enrolled": a.face_descriptor is not None,
            "photo_data":    a.photo_data or None,
        }
        for a in rows
    ]


@router.post("")
async def add_analyst(
    body: AnalystCreate,
    db:   AsyncSession = Depends(get_db),
    _:    str = Depends(get_current_analyst),
):
    # Check for duplicate ID
    existing = await db.execute(select(Analyst).where(Analyst.id == body.id))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail=f"Analyst {body.id} already exists")

    analyst = Analyst(
        id=body.id,
        name=body.name,
        role=body.role,
        institution=body.institution,
        email=body.email,
        is_active=True,
    )
    db.add(analyst)
    await db.commit()
    return {"success": True, "id": body.id, "name": body.name}


@router.post("/{analyst_id}/face")
async def enroll_face(
    analyst_id: str,
    body: FaceDescriptorUpdate,
    db:  AsyncSession = Depends(get_db),
    _:   str = Depends(get_current_analyst),
):
    """Store a 128-float face descriptor for an analyst (admin only)."""
    if len(body.descriptor) != 128:
        raise HTTPException(status_code=400, detail="Descriptor must be exactly 128 floats")

    result  = await db.execute(select(Analyst).where(Analyst.id == analyst_id))
    analyst = result.scalar_one_or_none()
    if not analyst:
        raise HTTPException(status_code=404, detail=f"Analyst {analyst_id} not found")

    analyst.face_descriptor = json.dumps(body.descriptor)
    if body.photo_data:
        analyst.photo_data = body.photo_data
    await db.commit()
    return {"success": True, "analyst_id": analyst_id, "message": "Face descriptor enrolled"}


@router.delete("/{analyst_id}")
async def remove_analyst(
    analyst_id: str,
    db:  AsyncSession = Depends(get_db),
    me:  str = Depends(get_current_analyst),
):
    if analyst_id == me:
        raise HTTPException(status_code=400, detail="You cannot remove yourself")

    result  = await db.execute(select(Analyst).where(Analyst.id == analyst_id))
    analyst = result.scalar_one_or_none()
    if not analyst:
        raise HTTPException(status_code=404, detail=f"Analyst {analyst_id} not found")

    db.delete(analyst)
    await db.commit()
    return {"success": True, "removed": analyst_id}
