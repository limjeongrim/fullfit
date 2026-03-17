import enum
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, Enum, Text
from backend.models.user import Base


class PromotionChannel(str, enum.Enum):
    SMARTSTORE = "SMARTSTORE"
    CAFE24 = "CAFE24"
    OLIVEYOUNG = "OLIVEYOUNG"
    ZIGZAG = "ZIGZAG"
    ALL = "ALL"


class Promotion(Base):
    __tablename__ = "promotions"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    channel = Column(Enum(PromotionChannel), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    expected_order_multiplier = Column(Float, default=1.0, nullable=False)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
