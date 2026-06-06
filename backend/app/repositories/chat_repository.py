from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.enums.chat import ChatMessageDirection, ChatMessageStatus, ChatRoomStage
from app.models.chat import ChatMessage, ChatRoom
from app.schemas.chat import ChatMessagePayload


async def get_latest_chat_message(db: AsyncSession, room_id: int) -> Optional[ChatMessage]:
    stmt = (
        select(ChatMessage)
        .where(ChatMessage.room_id == room_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_chat_rooms(db: AsyncSession) -> list[ChatRoom]:
    stmt = (
        select(ChatRoom)
        .options(joinedload(ChatRoom.customer))
        .order_by(ChatRoom.updated_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_chat_room_by_id(db: AsyncSession, room_id: int) -> Optional[ChatRoom]:
    stmt = (
        select(ChatRoom)
        .options(joinedload(ChatRoom.customer))
        .where(ChatRoom.id == room_id)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_chat_room_by_user_id(db: AsyncSession, customer_id: int) -> Optional[ChatRoom]:
    stmt = (
        select(ChatRoom)
        .options(joinedload(ChatRoom.customer))
        .where(ChatRoom.customer_id == customer_id)
        .order_by(ChatRoom.id.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_chat_room(db: AsyncSession, customer_id: int) -> ChatRoom:
    from app.repositories.user_repository import get_user_by_id

    customer = await get_user_by_id(db, customer_id)
    if not customer:
        raise ValueError(f"Customer {customer_id} not found")

    room = ChatRoom(
        store_id=customer.store_id,
        customer_id=customer_id,
        stage=ChatRoomStage.WELCOME,
        bot_step=-1,
        unread_count=0,
        created_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
        updated_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
    )
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return room


async def list_chat_messages(
    db: AsyncSession, room_id: int, after: Optional[datetime] = None
) -> list[ChatMessage]:
    stmt = select(ChatMessage).where(ChatMessage.room_id == room_id)
    if after:
        stmt = stmt.where(ChatMessage.created_at > after)
    stmt = stmt.order_by(ChatMessage.created_at.asc())

    result = await db.execute(stmt)
    return result.scalars().all()


async def switch_chat_room_mode(db: AsyncSession, room_id: int, mode: str) -> None:
    stmt = (
        update(ChatRoom)
        .where(ChatRoom.id == room_id)
        .values(stage=mode, updated_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None))
    )
    await db.execute(stmt)
    await db.commit()


async def create_chat_message_entry(
    db: AsyncSession,
    room_id: int,
    data: ChatMessagePayload,
    direction: ChatMessageDirection,
    message_status: ChatMessageStatus = ChatMessageStatus.SENT,
) -> ChatMessage:
    pkg = (data.sticker_package_id or "").strip() or None
    sid = (data.sticker_id or "").strip() or None
    img = (data.image_url or "").strip() or None
    text_val = (data.text or "").strip()
    if pkg and sid:
        text_val = text_val or "[貼圖]"
    elif img:
        text_val = text_val or "[圖片]"
    message = ChatMessage(
        room_id=room_id,
        direction=direction,
        text=text_val,
        image_url=img,
        sticker_package_id=pkg,
        sticker_id=sid,
        status=message_status,
        processed=False,
        created_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
        updated_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


async def touch_chat_room_updated_at(db: AsyncSession, room: ChatRoom) -> ChatRoom:
    room.updated_at = datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return room
