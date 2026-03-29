# app/routers/auth.py
import json
import numpy as np
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime, timezone

from app.database import get_db
from app.models.analyst import Analyst
from app.schemas.schemas import LoginRequest, LoginResponse, AnalystInfo, FaceLoginRequest
from app.services.auth_service import create_token
from app.services.seed import seed_analysts

FACE_THRESHOLD = 0.45  # Euclidean distance — lower = stricter match

router = APIRouter()


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    # Ensure seed analysts exist in DB
    await seed_analysts(db)

    result  = await db.execute(select(Analyst).where(Analyst.id == body.analyst_id))
    analyst = result.scalar_one_or_none()

    if not analyst:
        raise HTTPException(status_code=404, detail=f"Analyst '{body.analyst_id}' not found")
    if not analyst.is_active:
        raise HTTPException(status_code=403, detail="This account is inactive")

    # Update last_login
    analyst.last_login = datetime.now(timezone.utc)
    await db.commit()

    token = create_token(
        analyst.id,
        name=analyst.name,
        institution=analyst.institution or "",
        role=analyst.role,
    )
    return LoginResponse(
        token=token,
        analyst=AnalystInfo(
            id=analyst.id,
            name=analyst.name,
            role=analyst.role,
            institution=analyst.institution or "",
        ),
    )


@router.post("/face-login", response_model=LoginResponse)
async def face_login(body: FaceLoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Accepts a 128-float face descriptor from face-api.js FaceRecognitionNet.
    Compares against all enrolled analysts using Euclidean distance.
    Returns a JWT if distance < FACE_THRESHOLD, 401 otherwise.
    """
    if len(body.descriptor) != 128:
        raise HTTPException(status_code=400, detail="Descriptor must be exactly 128 floats")

    query_vec = np.array(body.descriptor, dtype=np.float64)

    # Load all active analysts that have an enrolled face
    result = await db.execute(
        select(Analyst).where(Analyst.is_active == True, Analyst.face_descriptor != None)  # noqa: E711
    )
    analysts = result.scalars().all()

    if not analysts:
        raise HTTPException(
            status_code=401,
            detail="No faces enrolled yet. Contact your administrator."
        )

    best_match: Analyst | None = None
    best_distance = float("inf")

    for analyst in analysts:
        stored_vec = np.array(json.loads(analyst.face_descriptor), dtype=np.float64)
        distance = float(np.linalg.norm(query_vec - stored_vec))
        if distance < best_distance:
            best_distance = distance
            best_match = analyst

    if best_distance > FACE_THRESHOLD:
        print(f"[FACE-LOGIN] FAILED best_distance={best_distance:.4f} threshold={FACE_THRESHOLD}")
        raise HTTPException(
            status_code=401,
            detail="Face not recognised. Contact your administrator."
        )

    best_match.last_login = datetime.now(timezone.utc)
    await db.commit()

    print(f"[FACE-LOGIN] SUCCESS analyst={best_match.id} name={best_match.name!r} distance={best_distance:.4f}")

    token = create_token(
        best_match.id,
        name=best_match.name,
        institution=best_match.institution or "",
        role=best_match.role,
    )
    return LoginResponse(
        token=token,
        analyst=AnalystInfo(
            id=best_match.id,
            name=best_match.name,
            role=best_match.role,
            institution=best_match.institution or "",
        ),
    )


@router.post("/logout")
async def logout():
    # JWT is stateless — the frontend just discards the token.
    # Add a token blocklist here if you need server-side invalidation.
    return {"message": "Logged out successfully"}
