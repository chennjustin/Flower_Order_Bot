from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.time import now_taipei_naive


class Store(Base):
    __tablename__ = "store"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    slug: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    timezone: Mapped[str] = mapped_column(String, nullable=False, default="Asia/Taipei")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_taipei_naive)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=now_taipei_naive, onupdate=now_taipei_naive
    )
    owner_auth_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)

    customers = relationship("Customer", back_populates="store")
    chat_rooms = relationship("ChatRoom", back_populates="store")
    payment_methods = relationship("PaymentMethod", back_populates="store")
    order_field_config = relationship(
        "StoreOrderFieldConfig",
        back_populates="store",
        uselist=False,
        cascade="all, delete-orphan",
    )
