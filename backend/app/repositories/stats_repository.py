from __future__ import annotations

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums.order import OrderStatus
from app.models.customer import Customer
from app.models.order import Order


async def count_today_orders(session: AsyncSession, today_start: datetime) -> int:
    stmt = select(func.count()).select_from(Order).where(Order.created_at >= today_start)
    return (await session.execute(stmt)).scalar() or 0


async def count_total_customers(session: AsyncSession) -> int:
    stmt = select(func.count()).select_from(Customer)
    return (await session.execute(stmt)).scalar() or 0


async def sum_monthly_income(session: AsyncSession, month_start: datetime) -> float:
    stmt = (
        select(func.coalesce(func.sum(Order.total_amount), 0))
        .select_from(Order)
        .where(Order.created_at >= month_start)
    )
    value = (await session.execute(stmt)).scalar()
    return float(value or 0)


async def count_pending_orders(session: AsyncSession) -> int:
    stmt = (
        select(func.count())
        .select_from(Order)
        .where(Order.status == OrderStatus.PENDING)
    )
    return (await session.execute(stmt)).scalar() or 0
