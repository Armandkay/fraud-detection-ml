# app/routers/stats.py
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from app.database import get_db
from app.models.transaction import Transaction
from app.models.alert import Alert
from app.schemas.schemas import StatsOut
from app.services.auth_service import get_current_analyst_data
from app.services.seed import seed_transactions, seed_alerts

router = APIRouter()

_SEE_ALL = {"", "Demo", "Inkingi Shield"}


def _inst_filter(col, institution: str):
    """Return a WHERE clause fragment that applies institution scoping."""
    if institution in _SEE_ALL:
        return None  # no filter
    return or_(col == institution, col.is_(None))


@router.get("", response_model=StatsOut)
async def get_stats(
    db:      AsyncSession = Depends(get_db),
    analyst: dict = Depends(get_current_analyst_data),
):
    await seed_transactions(db)
    await seed_alerts(db)

    institution = analyst.get("institution", "")
    tx_filter   = _inst_filter(Transaction.institution, institution)
    al_filter   = _inst_filter(Alert.institution,       institution)

    # Total transactions
    tx_q = select(func.count()).select_from(Transaction)
    if tx_filter is not None:
        tx_q = tx_q.where(tx_filter)
    total_tx = await db.scalar(tx_q) or 0

    # Fraud detected = alerts with score >= 50
    fd_q = select(func.count()).select_from(Alert).where(Alert.score >= 50)
    if al_filter is not None:
        fd_q = fd_q.where(al_filter)
    fraud_detected = await db.scalar(fd_q) or 0

    # Amount protected = sum of amount_num where alert was cancelled (blocked)
    ap_q = select(func.sum(Alert.amount_num)).where(Alert.status == "cancelled")
    if al_filter is not None:
        ap_q = ap_q.where(al_filter)
    amount_protected = await db.scalar(ap_q) or 0

    # False positive rate = cleared / total flagged
    tf_q = select(func.count()).select_from(Alert).where(Alert.score >= 50)
    if al_filter is not None:
        tf_q = tf_q.where(al_filter)
    total_flagged = await db.scalar(tf_q) or 1

    cl_q = select(func.count()).select_from(Alert).where(Alert.status == "approved")
    if al_filter is not None:
        cl_q = cl_q.where(al_filter)
    cleared = await db.scalar(cl_q) or 0
    fp_rate = round((cleared / total_flagged) * 100, 1) if total_flagged else 0

    # Format amount protected
    if amount_protected >= 1_000_000_000:
        amt_str = f"RWF {amount_protected/1_000_000_000:.1f}B"
    elif amount_protected >= 1_000_000:
        amt_str = f"RWF {amount_protected/1_000_000:.0f}M"
    else:
        amt_str = f"RWF {amount_protected:,.0f}"

    return StatsOut(
        totalTx=total_tx,
        fraudDetected=fraud_detected,
        amountProtected=amt_str,
        falsePositiveRate=f"{fp_rate}%",
        txChange="+12%",        # placeholder — wire to time-series data when you have it
        fraudChange="+4%",
        amountChange="+18%",
        fpChange="-0.3%",
    )
