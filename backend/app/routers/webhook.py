# app/routers/webhook.py
"""
Institution API Webhook
POST /api/webhook/transactions

Banks and fintechs call this endpoint with an api_key and a list of
transactions. Each transaction is scored and returned.
"""
import os
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app.ml.model import predict_fraud

router = APIRouter()

# API key — set WEBHOOK_API_KEY env var in production; falls back to demo key
_VALID_KEY = os.getenv("WEBHOOK_API_KEY", "ik-demo-key-2026")


# ── Schemas ───────────────────────────────────────────────────────────────────
class WebhookTransaction(BaseModel):
    id: Optional[str] = None
    amount: float
    type: str = "PAYMENT"
    old_balance: float = 0.0
    new_balance: float = 0.0


class WebhookRequest(BaseModel):
    institution: Optional[str] = None
    transactions: List[WebhookTransaction]


class WebhookResult(BaseModel):
    id: Optional[str]
    fraud_score: int
    is_fraud: bool
    level: str
    amount: float
    type: str


class WebhookResponse(BaseModel):
    scored: int
    institution: Optional[str]
    results: List[WebhookResult]


# ── Route ─────────────────────────────────────────────────────────────────────
@router.post("", response_model=WebhookResponse)
async def webhook_score(
    body: WebhookRequest,
    api_key: str = Query(..., description="Your institution API key"),
):
    if api_key != _VALID_KEY:
        raise HTTPException(status_code=401, detail="Invalid api_key")

    if not body.transactions:
        raise HTTPException(status_code=400, detail="transactions list is empty")

    if len(body.transactions) > 500:
        raise HTTPException(status_code=400, detail="Maximum 500 transactions per request")

    results = []
    for tx in body.transactions:
        pred = await predict_fraud(tx.amount, tx.type, tx.old_balance, tx.new_balance)
        score = pred.get("fraud_score", 0)
        level = "HIGH" if score >= 70 else "MEDIUM" if score >= 40 else "LOW"
        results.append(WebhookResult(
            id=tx.id,
            fraud_score=score,
            is_fraud=pred.get("is_fraud", False),
            level=level,
            amount=tx.amount,
            type=tx.type,
        ))

    return WebhookResponse(
        scored=len(results),
        institution=body.institution,
        results=results,
    )
