from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.time import now_taipei_naive
from app.enums.order import OrderStatus
from app.enums.shipment import ShipmentMethod


class OrderDraft(Base):
    __tablename__ = "order_draft"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("chat_room.id", ondelete="CASCADE"), nullable=False)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customer.id", ondelete="RESTRICT"), nullable=False)

    item_type: Mapped[str | None] = mapped_column(String, nullable=True)
    quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_amount: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    shipment_method: Mapped[ShipmentMethod | None] = mapped_column(
        SAEnum(ShipmentMethod, name="shipment_method", validate_strings=True),
        nullable=True,
    )
    pay_way: Mapped[str | None] = mapped_column(String, nullable=True)
    delivery_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_datetime: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_taipei_naive)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=now_taipei_naive, onupdate=now_taipei_naive
    )

    customer = relationship("Customer", back_populates="order_drafts")
    room = relationship("ChatRoom", back_populates="order_drafts")


class Order(Base):
    __tablename__ = "order"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("chat_room.id", ondelete="RESTRICT"), nullable=False)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customer.id", ondelete="RESTRICT"), nullable=False)

    status: Mapped[OrderStatus] = mapped_column(
        SAEnum(OrderStatus, name="order_status", validate_strings=True),
        default=OrderStatus.PENDING,
    )
    item_type: Mapped[str] = mapped_column(String, nullable=False)
    quantity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    total_amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    shipment_method: Mapped[ShipmentMethod | None] = mapped_column(
        SAEnum(ShipmentMethod, name="shipment_method", validate_strings=True),
        nullable=True,
    )
    pay_way: Mapped[str | None] = mapped_column(String, nullable=True)
    delivery_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    delivery_datetime: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_taipei_naive)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=now_taipei_naive, onupdate=now_taipei_naive
    )

    customer = relationship("Customer", back_populates="orders")
    payments = relationship("Payment", back_populates="order")
