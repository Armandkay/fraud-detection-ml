# app/models/customer.py
from sqlalchemy import Column, String, Integer, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Customer(Base):
    __tablename__ = "customers"

    id           = Column(String,  primary_key=True, index=True)  # CUST-001
    name         = Column(String,  nullable=False)
    initials     = Column(String(4))
    phone        = Column(String(30))
    email        = Column(String(100))
    location     = Column(String(100))
    joined       = Column(String(30))
    transactions = Column(Integer, default=0)
    total_volume = Column(String(30))
    risk_score   = Column(Integer, default=0)
    status       = Column(String(20), default="low-risk")        # high-risk/medium-risk/low-risk
    flags        = Column(Integer, default=0)
    institution  = Column(String(100), nullable=True, index=True)  # owning institution; NULL = shared
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
