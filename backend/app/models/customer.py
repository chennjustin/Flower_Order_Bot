from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.time import now_taipei_naive


class Customer(Base):
    __tablename__ = "customer"

    id: Mapped[int] = mapped_column(primary_key=True)
    line_uid: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String, nullable=True)
    has_ordered: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_taipei_naive)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=now_taipei_naive, onupdate=now_taipei_naive
    )
    store_id: Mapped[int] = mapped_column(ForeignKey("store.id", ondelete="CASCADE"), nullable=False)

    store = relationship("Store", back_populates="customers")
    chat_rooms = relationship("ChatRoom", back_populates="customer")
    orders = relationship("Order", back_populates="customer")
    order_drafts = relationship("OrderDraft", back_populates="customer")
