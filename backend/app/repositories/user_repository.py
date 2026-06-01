from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.chat import ChatRoom
from app.models.customer import Customer
from app.schemas.customer import CustomerCreate


def now_taipei_naive() -> datetime:
    return datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)


async def get_user_by_id(db: AsyncSession, user_id: int) -> Optional[Customer]:
    stmt = select(Customer).where(Customer.id == user_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_line_uid(db: AsyncSession, line_uid: str) -> Optional[Customer]:
    stmt = select(Customer).where(Customer.line_uid == line_uid)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_user_by_chat_room_id(db: AsyncSession, chat_room_id: int) -> Optional[Customer]:
    chat_room_result = await db.execute(
        select(ChatRoom)
        .options(selectinload(ChatRoom.customer))
        .where(ChatRoom.id == chat_room_id)
    )
    chat_room = chat_room_result.scalar_one_or_none()
    if not chat_room:
        return None
    return chat_room.customer


async def create_user(db: AsyncSession, user_data: CustomerCreate) -> Customer:
    payload = user_data.model_dump() if hasattr(user_data, "model_dump") else user_data.dict()
    if not payload.get("store_id"):
        raise ValueError("store_id is required when creating a customer")
    if payload.get("has_ordered") is None:
        payload["has_ordered"] = False
    user = Customer(**payload)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update_user_info(
    db: AsyncSession,
    user_id: int,
    name: Optional[str] = None,
    phone: Optional[str] = None,
) -> Customer:
    user = await get_user_by_id(db, user_id)
    if not user:
        raise Exception("User not found")
    if name:
        user.name = name
    if phone:
        user.phone = phone
    user.updated_at = now_taipei_naive()
    await db.commit()
    await db.refresh(user)
    return user
