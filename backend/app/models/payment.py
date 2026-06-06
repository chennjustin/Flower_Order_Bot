from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.time import now_taipei_naive
from app.enums.payment import PaymentStatus


class Payment(Base):
    __tablename__ = "payment"

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("order.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[PaymentStatus] = mapped_column(
        SAEnum(PaymentStatus, name="payment_status", validate_strings=True),
        default=PaymentStatus.PENDING,
    )
    method_id: Mapped[int] = mapped_column(ForeignKey("payment_method.id", ondelete="RESTRICT"), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    screenshot_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_taipei_naive)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=now_taipei_naive, onupdate=now_taipei_naive
    )

    order = relationship("Order", back_populates="payments")
    method = relationship("PaymentMethod", back_populates="payments")


class PaymentMethod(Base):
    __tablename__ = "payment_method"
    __table_args__ = (UniqueConstraint("store_id", "code", name="uq_payment_method_store_code"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("store.id", ondelete="CASCADE"), nullable=False)
    code: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    display_image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    requires_manual_confirm: Mapped[bool] = mapped_column(Boolean, default=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    store = relationship("Store", back_populates="payment_methods")
    payments = relationship("Payment", back_populates="method")
