"""
app/schemas/schemas.py

Pydantic models = the shapes of data going IN and OUT of the API.
These field names must match exactly what the React frontend expects.
"""

from pydantic import BaseModel
from typing import Optional, List


# ── Auth ──────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    analyst_id: str          # "AK-001"
    source: str = "biometric"

class FaceLoginRequest(BaseModel):
    descriptor: List[float]  # 128 floats from face-api.js FaceRecognitionNet

class FaceDescriptorUpdate(BaseModel):
    descriptor: List[float]       # 128 floats to enroll for an analyst
    photo_data: Optional[str] = None  # base64 JPEG thumbnail (optional)

class AnalystInfo(BaseModel):
    id:          str
    name:        str
    role:        str
    institution: str = ""

class LoginResponse(BaseModel):
    token:   str
    analyst: AnalystInfo


# ── Alert ─────────────────────────────────────────────────────────────────────
class AlertOut(BaseModel):
    id:          str
    customer:    str
    initials:    str
    score:       int
    level:       str
    amount:      str
    amountNum:   float          # camelCase — matches frontend ALERTS_DATA
    phone:       str
    email:       str
    address:     str
    device:      str
    type:        str
    time:        str
    phoneRisk:   str
    emailRisk:   str
    addressRisk: str
    deviceRisk:  str
    status:      str
    reason:      str

class AlertStatusUpdate(BaseModel):
    status: str                 # "approved" or "cancelled"


# ── Transaction ───────────────────────────────────────────────────────────────
class TransactionOut(BaseModel):
    id:       str
    customer: str
    amount:   str
    type:     str
    date:     str
    score:    int
    status:   str
    channel:  str


# ── Customer ──────────────────────────────────────────────────────────────────
class CustomerOut(BaseModel):
    id:           str
    name:         str
    initials:     str
    phone:        str
    email:        str
    location:     str
    joined:       str
    transactions: int
    totalVolume:  str           # camelCase — matches frontend CUSTOMERS_DATA
    riskScore:    int
    status:       str
    flags:        int


# ── Stats ─────────────────────────────────────────────────────────────────────
class StatsOut(BaseModel):
    totalTx:          int
    fraudDetected:    int
    amountProtected:  str
    falsePositiveRate: str
    txChange:         str
    fraudChange:      str
    amountChange:     str
    fpChange:         str


# ── Predict ───────────────────────────────────────────────────────────────────
class PredictRequest(BaseModel):
    amount:           float
    transaction_type: str        # "CASH_OUT" / "TRANSFER" / "PAYMENT" / "CASH_IN"
    old_balance:      float = 0.0
    new_balance:      float = 0.0
    customer_id:      Optional[str] = None

class FeatureItem(BaseModel):
    feature:    str
    importance: float

class PredictResponse(BaseModel):
    fraud_score:  int            # 0–100
    is_fraud:     bool
    confidence:   float
    top_features: List[FeatureItem]


# ── Alert Import (MoMo batch import) ──────────────────────────────────────────
class AlertImportItem(BaseModel):
    customer:   str
    score:      int
    level:      str
    amount:     str
    amount_num: float = 0.0
    type:       str = "Mobile Money"
    reason:     str = ""
    time:       str = ""

class AlertImportRequest(BaseModel):
    alerts: List[AlertImportItem]

class AlertImportResponse(BaseModel):
    created: int
    ids:     List[str]
