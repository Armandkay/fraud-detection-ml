# app/models/analyst.py
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.sql import func
from app.database import Base


class Analyst(Base):
    __tablename__ = "analysts"

    id              = Column(String,  primary_key=True, index=True)  # AK-001
    name            = Column(String,  nullable=False)
    role            = Column(String(80), default="Fraud Analyst")
    institution     = Column(String(100))
    email           = Column(String(100))
    is_active       = Column(Boolean, default=True)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())
    last_login      = Column(DateTime(timezone=True), nullable=True)
    face_descriptor = Column(Text, nullable=True)  # JSON array of 128 floats
    photo_data      = Column(Text, nullable=True)  # base64 JPEG thumbnail for admin display
