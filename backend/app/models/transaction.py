# app/models/transaction.py
from sqlalchemy import Column, String, Integer, Float, DateTime
from sqlalchemy.sql import func
from app.database import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id         = Column(String,  primary_key=True, index=True)   # TXN-8821
    customer   = Column(String,  nullable=False)
    amount     = Column(String(30))
    amount_num = Column(Float, default=0)
    type       = Column(String(50))
    date       = Column(String(50))
    score      = Column(Integer, default=0)
    status     = Column(String(15), default="clear")             # clear/flagged/blocked
    channel      = Column(String(50))
    institution  = Column(String(100), nullable=True, index=True)  # owning institution; NULL = shared
    created_at   = Column(DateTime(timezone=True), server_default=func.now())
