# app/services/auth_service.py
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRE_HOURS

bearer = HTTPBearer()


def create_token(
    analyst_id: str,
    name: str = "",
    institution: str = "",
    role: str = "",
) -> str:
    """Create a signed JWT for the analyst."""
    expire = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRE_HOURS)
    payload = {
        "sub": analyst_id,
        "name": name,
        "institution": institution,
        "role": role,
        "exp": expire,
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_analyst(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> str:
    """FastAPI dependency — returns analyst_id string."""
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        analyst_id: str = payload.get("sub")
        if not analyst_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return analyst_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalid or expired")


def get_current_analyst_data(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    """FastAPI dependency — returns full analyst dict from JWT claims."""
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        analyst_id: str = payload.get("sub")
        if not analyst_id:
            raise HTTPException(status_code=401, detail="Invalid token payload")
        return {
            "id": analyst_id,
            "name": payload.get("name", ""),
            "institution": payload.get("institution", ""),
            "role": payload.get("role", ""),
        }
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalid or expired")
