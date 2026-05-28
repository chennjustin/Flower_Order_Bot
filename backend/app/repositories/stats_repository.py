from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums.order import OrderStatus
from app.models.customer import Customer
from app.models.order import Order


async def count_today_orders(
    session: AsyncSession, store_id: int, today_start: datetime
) -> int:
    stmt = (
        select(func.count())
        .select_from(Order)
        .join(Customer, Order.customer_id == Customer.id)
        .where(Order.created_at >= today_start, Customer.store_id == store_id)
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


async def count_pending_orders(session: AsyncSession, store_id: int) -> int:
    stmt = (
        select(func.count())
        .select_from(Order)
        .join(Customer, Order.customer_id == Customer.id)
        .where(Order.status == OrderStatus.PENDING, Customer.store_id == store_id)
    )
    return (await session.execute(stmt)).scalar() or 0
