from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.time import now_taipei_naive
from app.enums.chat import ChatMessageDirection, ChatMessageStatus, ChatRoomStage


class ChatRoom(Base):
    __tablename__ = "chat_room"

    id: Mapped[int] = mapped_column(primary_key=True)
    store_id: Mapped[int] = mapped_column(ForeignKey("store.id", ondelete="CASCADE"), nullable=False)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customer.id", ondelete="RESTRICT"), nullable=False)
    stage: Mapped[ChatRoomStage] = mapped_column(
        SAEnum(ChatRoomStage, name="chat_room_stage", validate_strings=True),
        default=ChatRoomStage.WELCOME,
    )
    bot_step: Mapped[int] = mapped_column(SmallInteger, default=0)
    last_message_ts: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    unread_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_taipei_naive)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=now_taipei_naive, onupdate=now_taipei_naive
    )

    messages = relationship("ChatMessage", back_populates="room")
    customer = relationship("Customer", back_populates="chat_rooms")
    store = relationship("Store", back_populates="chat_rooms")
    order_drafts = relationship("OrderDraft", back_populates="room")

    @property
    def user(self):
        """相容舊程式碼的 room.user。"""
        return self.customer

    @property
    def user_id(self) -> int:
        return self.customer_id


class ChatMessage(Base):
    __tablename__ = "chat_message"

    id: Mapped[int] = mapped_column(primary_key=True)
    room_id: Mapped[int] = mapped_column(ForeignKey("chat_room.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[ChatMessageStatus] = mapped_column(
        SAEnum(ChatMessageStatus, name="chat_message_status", validate_strings=True),
        default=ChatMessageStatus.SENT,
    )
    direction: Mapped[ChatMessageDirection] = mapped_column(
        SAEnum(ChatMessageDirection, name="chat_message_direction", validate_strings=True),
    )
    text: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    line_msg_id: Mapped[str | None] = mapped_column(String, nullable=True)
    processed: Mapped[bool] = mapped_column(default=False)
    sticker_package_id: Mapped[str | None] = mapped_column(String, nullable=True)
    sticker_id: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=now_taipei_naive)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=now_taipei_naive, onupdate=now_taipei_naive
    )

    room = relationship("ChatRoom", back_populates="messages")
