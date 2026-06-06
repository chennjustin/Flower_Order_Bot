from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import String, cast, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums.order import OrderStatus
from app.models.chat import ChatRoom
from app.models.order import Order, OrderDraft
from app.core.time import now_taipei_naive


@dataclass
class OrderListFilters:
    store_id: int
    status: Optional[str] = None
    pickup_date: Optional[date] = None
    pickup_from: Optional[datetime] = None
    pickup_to: Optional[datetime] = None
    q: Optional[str] = None
    include_cancelled: bool = False


__all__ = [
    "now_taipei_naive",
    "OrderListFilters",
    "get_order_by_id",
    "list_active_orders",
    "list_all_orders",
    "list_orders_by_customer_id",
    "list_orders_filtered",
    "count_orders_filtered",
    "get_latest_confirmed_order_by_room",
    "get_latest_order_draft_by_room",
    "save_order",
    "save_order_draft",
]


async def get_order_by_id(db: AsyncSession, order_id: int) -> Optional[Order]:
    stmt = select(Order).where(Order.id == order_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def list_active_orders(
    db: AsyncSession, store_id: int | None = None
) -> list[Order]:
    from app.models.chat import ChatRoom
    from sqlalchemy import or_, and_

    stmt = select(Order).where(Order.status != OrderStatus.CANCELLED)
    if store_id is not None:
        stmt = stmt.outerjoin(ChatRoom, Order.room_id == ChatRoom.id).where(
            or_(
                and_(Order.room_id != None, ChatRoom.store_id == store_id),  # noqa: E711
                and_(Order.room_id == None, Order.store_id == store_id),  # noqa: E711
            )
        )
    result = await db.execute(stmt)
    return result.scalars().all()


async def list_all_orders(
    db: AsyncSession, store_id: int | None = None
) -> list[Order]:
    """All orders including CANCELLED (for dashboard「所有訂單」)."""
    from app.models.chat import ChatRoom
    from sqlalchemy import or_, and_

    stmt = select(Order)
    if store_id is not None:
        stmt = stmt.outerjoin(ChatRoom, Order.room_id == ChatRoom.id).where(
            or_(
                and_(Order.room_id != None, ChatRoom.store_id == store_id),  # noqa: E711
                and_(Order.room_id == None, Order.store_id == store_id),  # noqa: E711
            )
        )
    result = await db.execute(stmt)
    return result.scalars().all()


def _apply_order_list_filters(stmt, filters: OrderListFilters):
    stmt = stmt.join(ChatRoom, Order.room_id == ChatRoom.id).where(
        ChatRoom.store_id == filters.store_id
    )
    if not filters.include_cancelled:
        stmt = stmt.where(Order.status != OrderStatus.CANCELLED)
    if filters.status == "in_progress":
        stmt = stmt.where(
            Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.PENDING])
        )
    elif filters.status == "completed":
        stmt = stmt.where(Order.status == OrderStatus.COMPLETED)
    if filters.pickup_date is not None:
        day_start = datetime.combine(filters.pickup_date, datetime.min.time())
        day_end = day_start + timedelta(days=1)
        stmt = stmt.where(
            Order.delivery_datetime.is_not(None),
            Order.delivery_datetime >= day_start,
            Order.delivery_datetime < day_end,
        )
    if filters.pickup_from is not None:
        stmt = stmt.where(
            Order.delivery_datetime.is_not(None),
            Order.delivery_datetime >= filters.pickup_from,
        )
    if filters.pickup_to is not None:
        stmt = stmt.where(
            Order.delivery_datetime.is_not(None),
            Order.delivery_datetime < filters.pickup_to,
        )
    q = (filters.q or "").strip()
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                Order.customer_name.ilike(pattern),
                Order.customer_phone.ilike(pattern),
                Order.item_type.ilike(pattern),
                Order.notes.ilike(pattern),
                cast(Order.id, String).ilike(pattern),
            )
        )
    return stmt


async def count_orders_filtered(db: AsyncSession, filters: OrderListFilters) -> int:
    stmt = select(func.count()).select_from(Order)
    stmt = _apply_order_list_filters(stmt, filters)
    result = await db.execute(stmt)
    return int(result.scalar() or 0)


async def list_orders_filtered(
    db: AsyncSession,
    filters: OrderListFilters,
    *,
    limit: Optional[int] = None,
    offset: int = 0,
) -> list[Order]:
    stmt = select(Order)
    stmt = _apply_order_list_filters(stmt, filters)
    stmt = stmt.order_by(Order.id.desc())
    if limit is not None:
        stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def list_orders_by_customer_id(db: AsyncSession, customer_id: int) -> list[Order]:
    stmt = (
        select(Order)
        .where(Order.customer_id == customer_id)
        .order_by(Order.created_at.desc())
    )
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

