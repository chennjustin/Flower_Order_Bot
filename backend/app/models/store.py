from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.time import now_taipei_naive


class Store(Base):
    __tablename__ = "store"
    __table_args__ = (UniqueConstraint("owner_email", name="uq_store_owner_email"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    # LINE webhook destination (channel user id, e.g. U4b…); must match JSON "destination"
    slug: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    line_channel_access_token: Mapped[str | None] = mapped_column(String, nullable=True)
    line_channel_secret: Mapped[str | None] = mapped_column(String, nullable=True)
    timezone: Mapped[str] = mapped_column(String, nullable=False, default="Asia/Taipei")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_taipei_naive)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=now_taipei_naive, onupdate=now_taipei_naive
    )
    # 管理者指派的店主 Gmail（小寫）；首次登入時用來認領 store
    owner_email: Mapped[str] = mapped_column(String, nullable=False)
    # 首次登入時由 Supabase auth user id 綁定；未綁定前為 NULL（partial-unique 由 DB 端建立）
    owner_auth_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    owner_display_name: Mapped[str | None] = mapped_column(String, nullable=True)

    # Google Calendar 整合（店主授權後填入）；refresh token 以 Fernet 加密儲存
    google_calendar_refresh_token: Mapped[str | None] = mapped_column(String, nullable=True)
    # 連結的 Google 帳號 email（顯示用）
    google_calendar_email: Mapped[str | None] = mapped_column(String, nullable=True)
    # 寫入哪個日曆；預設 primary（店主主日曆）
    google_calendar_id: Mapped[str | None] = mapped_column(String, nullable=True, default="primary")

    customers = relationship("Customer", back_populates="store")
    chat_rooms = relationship("ChatRoom", back_populates="store")
    payment_methods = relationship("PaymentMethod", back_populates="store")
    order_field_config = relationship(
        "StoreOrderFieldConfig",
        back_populates="store",
        uselist=False,
        cascade="all, delete-orphan",
    )
