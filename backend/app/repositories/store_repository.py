from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.store import Store


async def get_first_store_id(db: AsyncSession) -> int | None:
    result = await db.execute(select(Store.id).order_by(Store.id).limit(1))
    return result.scalar_one_or_none()
