from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.order import Order
from app.models.user import User


async def count_today_orders(session: AsyncSession, today_start: datetime) -> int:
    stmt = select(func.count()).where(Order.created_at >= today_start)
    return (await session.execute(stmt)).scalar() or 0


async def count_total_customers(session: AsyncSession) -> int:
    stmt = select(func.count()).select_from(User)
    return (await session.execute(stmt)).scalar() or 0


async def sum_monthly_income(session: AsyncSession, month_start: datetime) -> float:
    stmt = select(func.coalesce(func.sum(Order.total_amount), 0)).where(Order.created_at >= month_start)
    value = (await session.execute(stmt)).scalar()
    return float(value or 0)


async def count_pending_orders(session: AsyncSession) -> int:
    stmt = select(func.count()).select_from(Order)
    return (await session.execute(stmt)).scalar() or 0

