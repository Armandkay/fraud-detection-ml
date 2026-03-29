# app/routers/predict.py
from fastapi import APIRouter, Depends

from app.schemas.schemas import PredictRequest, PredictResponse
from app.services.auth_service import get_current_analyst
from app.ml.model import predict_fraud

router = APIRouter()


@router.post("", response_model=PredictResponse)
async def predict(
    body: PredictRequest,
    _:    str = Depends(get_current_analyst),
):
    result = await predict_fraud(
        amount      = body.amount,
        tx_type     = body.transaction_type,
        old_balance = body.old_balance,
        new_balance = body.new_balance,
    )
    return PredictResponse(**result)
