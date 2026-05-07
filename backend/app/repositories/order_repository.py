from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums.order import OrderStatus
from app.models.order import Order, OrderDraft


def now_taipei_naive() -> datetime:
    return datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)


async def get_order_by_id(db: AsyncSession, order_id: int) -> Optional[Order]:
    stmt = select(Order).where(Order.id == order_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_active_orders(db: AsyncSession) -> list[Order]:
    stmt = select(Order).where(Order.status != OrderStatus.CANCELLED)
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_latest_confirmed_order_by_room(db: AsyncSession, room_id: int) -> Optional[Order]:
    stmt = (
        select(Order)
        .where(Order.room_id == room_id, Order.status == OrderStatus.CONFIRMED)
        .order_by(Order.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def get_latest_order_draft_by_room(db: AsyncSession, room_id: int) -> Optional[OrderDraft]:
    stmt = (
        select(OrderDraft)
        .where(OrderDraft.room_id == room_id)
        .order_by(OrderDraft.created_at.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def save_order(db: AsyncSession, order: Order) -> Order:
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return order


async def save_order_draft(db: AsyncSession, order_draft: OrderDraft) -> OrderDraft:
    db.add(order_draft)
    await db.commit()
    await db.refresh(order_draft)
    return order_draft

