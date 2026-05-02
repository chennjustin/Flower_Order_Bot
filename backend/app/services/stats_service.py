from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta, timezone
from app.repositories.stats_repository import (
    count_pending_orders,
    count_today_orders,
    count_total_customers,
    sum_monthly_income,
)

async def get_stats(session: AsyncSession):
    now = datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)
    today_start = datetime(now.year, now.month, now.day)
    month_start = datetime(now.year, now.month, 1)

    today_orders = await count_today_orders(session, today_start)
    total_customers = await count_total_customers(session)
    monthly_income = await sum_monthly_income(session, month_start)
    pending_orders = await count_pending_orders(session)

    return {
        "today_orders": today_orders,
        "pending_orders": pending_orders,
        "monthly_income": monthly_income,
        "total_customers": total_customers
    }
