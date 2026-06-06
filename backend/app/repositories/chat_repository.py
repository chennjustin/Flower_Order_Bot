from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import and_, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.enums.chat import ChatMessageDirection, ChatMessageStatus, ChatRoomStage
from app.models.chat import ChatMessage, ChatRoom
from app.models.customer import Customer
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


def _apply_chat_room_filters(
    stmt,
    *,
    store_id: int,
    stage: Optional[ChatRoomStage] = None,
    q: Optional[str] = None,
):
    stmt = stmt.join(Customer, ChatRoom.customer_id == Customer.id).where(
        ChatRoom.store_id == store_id
    )
    if stage is not None:
        stmt = stmt.where(ChatRoom.stage == stage)
    search = (q or "").strip()
    if search:
        stmt = stmt.where(Customer.name.ilike(f"%{search}%"))
    return stmt


async def sum_store_unread_count(db: AsyncSession, store_id: int) -> int:
    stmt = select(func.coalesce(func.sum(ChatRoom.unread_count), 0)).where(
        ChatRoom.store_id == store_id
    )
    result = await db.execute(stmt)
    return int(result.scalar() or 0)


async def count_chat_rooms_filtered(
    db: AsyncSession,
    store_id: int,
    *,
    stage: Optional[ChatRoomStage] = None,
    q: Optional[str] = None,
) -> int:
    stmt = select(func.count()).select_from(ChatRoom)
    stmt = _apply_chat_room_filters(stmt, store_id=store_id, stage=stage, q=q)
    result = await db.execute(stmt)
    return int(result.scalar() or 0)


async def count_filtered_unread_rooms(
    db: AsyncSession,
    store_id: int,
    *,
    stage: Optional[ChatRoomStage] = None,
    q: Optional[str] = None,
) -> int:
    stmt = select(func.count()).select_from(ChatRoom)
    stmt = _apply_chat_room_filters(stmt, store_id=store_id, stage=stage, q=q)
    stmt = stmt.where(ChatRoom.unread_count > 0)
    result = await db.execute(stmt)
    return int(result.scalar() or 0)


async def list_chat_rooms_paginated(
    db: AsyncSession,
    store_id: int,
    *,
    limit: int,
    offset: int,
    stage: Optional[ChatRoomStage] = None,
    q: Optional[str] = None,
) -> list[ChatRoom]:
    stmt = select(ChatRoom).options(joinedload(ChatRoom.customer))
    stmt = _apply_chat_room_filters(stmt, store_id=store_id, stage=stage, q=q)
    stmt = stmt.order_by(
        func.coalesce(ChatRoom.last_message_ts, ChatRoom.updated_at).desc()
    )
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


async def get_latest_messages_for_room_ids(
    db: AsyncSession, room_ids: list[int]
) -> dict[int, ChatMessage]:
    if not room_ids:
        return {}
    latest_subq = (
        select(
            ChatMessage.room_id,
            func.max(ChatMessage.created_at).label("max_created_at"),
        )
        .where(ChatMessage.room_id.in_(room_ids))
        .group_by(ChatMessage.room_id)
        .subquery()
    )
    stmt = select(ChatMessage).join(
        latest_subq,
        and_(
            ChatMessage.room_id == latest_subq.c.room_id,
            ChatMessage.created_at == latest_subq.c.max_created_at,
        ),
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()
    return {message.room_id: message for message in messages}


async def list_chat_rooms(db: AsyncSession, store_id: int | None = None) -> list[ChatRoom]:
    if store_id is None:
        stmt = (
            select(ChatRoom)
            .options(joinedload(ChatRoom.customer))
            .order_by(ChatRoom.updated_at.desc())
        )
    else:
        return await list_chat_rooms_paginated(
            db,
            store_id,
            limit=10_000,
            offset=0,
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


async def mark_chat_room_as_read(db: AsyncSession, room: ChatRoom) -> int:
    previous_unread = int(room.unread_count or 0)
    if previous_unread <= 0:
        return 0
    room.unread_count = 0
    room.updated_at = datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)
    db.add(room)
    await db.commit()
    await db.refresh(room)
    return previous_unread
