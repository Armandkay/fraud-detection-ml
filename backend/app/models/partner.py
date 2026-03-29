# app/models/partner.py
from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.sql import func
from app.database import Base


class PartnerRequest(Base):
    __tablename__ = "partner_requests"

    id                 = Column(String,     primary_key=True, index=True)
    company_name       = Column(String(200), nullable=False)
    institution_type   = Column(String(100))
    contact_name       = Column(String(200))
    contact_email      = Column(String(200))
    transaction_volume = Column(String(100))
    message            = Column(Text)
    # Pipeline: new → under_review → approved → onboarded → active  |  rejected
    status             = Column(String(50), default="new")
    created_at         = Column(DateTime(timezone=True), server_default=func.now())
    updated_at         = Column(DateTime(timezone=True), nullable=True)
