from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.time import now_taipei_naive


class StoreOrderFieldConfig(Base):
    __tablename__ = "store_order_field_config"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    store_id: Mapped[int] = mapped_column(
        ForeignKey("store.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    visible_fields: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    organize_required_fields: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_taipei_naive)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=now_taipei_naive, onupdate=now_taipei_naive
    )

    store = relationship("Store", back_populates="order_field_config")
