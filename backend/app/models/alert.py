# app/models/alert.py
from sqlalchemy import Column, String, Integer, Float, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id           = Column(String,  primary_key=True, index=True)   # e.g. RW-4821
    customer     = Column(String,  nullable=False)
    initials     = Column(String(4))
    score        = Column(Integer, nullable=False)
    level        = Column(String(10))                               # CRITICAL/HIGH/MEDIUM/LOW
    amount       = Column(String(30))                               # "RWF 4,250,000"
    amount_num   = Column(Float,   default=0)
    phone        = Column(String(30))
    email        = Column(String(100))
    address      = Column(String(200))
    device       = Column(String(100))
    type         = Column(String(50))                               # Mobile Money / Bank Transfer
    time         = Column(String(30))                               # "2m ago"
    phone_risk   = Column(String(10), default="low")
    email_risk   = Column(String(10), default="low")
    address_risk = Column(String(10), default="low")
    device_risk  = Column(String(10), default="low")
    status       = Column(String(15), default="pending")           # pending/approved/cancelled
    reason       = Column(Text)
    institution  = Column(String(100), nullable=True, index=True)  # owning institution; NULL = shared
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
    updated_at   = Column(DateTime(timezone=True), onupdate=func.now())
