from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums.order import OrderStatus
from app.models.customer import Customer
from app.models.order import Order


async def count_today_orders(
    session: AsyncSession, store_id: int, today_start: datetime, today_end: datetime
) -> int:
    stmt = (
        select(func.count())
        .select_from(Order)
        .join(Customer, Order.customer_id == Customer.id)
        .where(
            Order.delivery_datetime >= today_start,
            Order.delivery_datetime < today_end,
            Order.status != OrderStatus.CANCELLED,
            Customer.store_id == store_id,
        )
    )
    return (await session.execute(stmt)).scalar() or 0


async def count_total_customers(session: AsyncSession, store_id: int) -> int:
    stmt = select(func.count()).select_from(Customer).where(Customer.store_id == store_id)
    return (await session.execute(stmt)).scalar() or 0


async def sum_monthly_income(
    session: AsyncSession, store_id: int, month_start: datetime
) -> float:
    stmt = (
        select(func.coalesce(func.sum(Order.total_amount), 0))
        .select_from(Order)
        .join(Customer, Order.customer_id == Customer.id)
        .where(Order.created_at >= month_start, Customer.store_id == store_id)
    )
    value = (await session.execute(stmt)).scalar()
    return float(value or 0)


async def count_monthly_orders(
    session: AsyncSession, store_id: int, month_start: datetime
) -> int:
    stmt = (
        select(func.count())
        .select_from(Order)
        .join(Customer, Order.customer_id == Customer.id)
        .where(Order.created_at >= month_start, Customer.store_id == store_id)
    )
    return (await session.execute(stmt)).scalar() or 0


async def count_today_completed(
    session: AsyncSession, store_id: int, today_start: datetime, today_end: datetime
) -> int:
    stmt = (
        select(func.count())
        .select_from(Order)
        .join(Customer, Order.customer_id == Customer.id)
        .where(
            Order.delivery_datetime >= today_start,
            Order.delivery_datetime < today_end,
            Order.status == OrderStatus.COMPLETED,
            Customer.store_id == store_id,
        )
    )
    return (await session.execute(stmt)).scalar() or 0


async def count_pending_orders(session: AsyncSession, store_id: int) -> int:
    stmt = (
        select(func.count())
        .select_from(Order)
        .join(Customer, Order.customer_id == Customer.id)
        .where(Order.status == OrderStatus.PENDING, Customer.store_id == store_id)
    )
    return (await session.execute(stmt)).scalar() or 0


async def count_in_progress_orders(session: AsyncSession, store_id: int) -> int:
    stmt = (
        select(func.count())
        .select_from(Order)
        .join(Customer, Order.customer_id == Customer.id)
        .where(
            Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.PENDING]),
            Customer.store_id == store_id,
        )
    )
    return (await session.execute(stmt)).scalar() or 0
