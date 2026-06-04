from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta, timezone
from app.repositories.stats_repository import (
    count_monthly_orders,
    count_pending_orders,
    count_today_completed,
    count_today_orders,
    count_total_customers,
    sum_monthly_income,
)

async def get_stats(session: AsyncSession, store_id: int):
    now = datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)
    today_start = datetime(now.year, now.month, now.day)
    today_end = today_start + timedelta(days=1)
    month_start = datetime(now.year, now.month, 1)

    today_orders = await count_today_orders(session, store_id, today_start, today_end)
    today_completed = await count_today_completed(session, store_id, today_start, today_end)
    total_customers = await count_total_customers(session, store_id)
    monthly_income = await sum_monthly_income(session, store_id, month_start)
    monthly_orders = await count_monthly_orders(session, store_id, month_start)
    pending_orders = await count_pending_orders(session, store_id)

    return {
        "today_orders": today_orders,
        "today_completed": today_completed,
        "pending_orders": pending_orders,
        "monthly_income": monthly_income,
        "monthly_orders": monthly_orders,
        "total_customers": total_customers
    }
