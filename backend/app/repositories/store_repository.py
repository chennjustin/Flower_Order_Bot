from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.store import Store


async def list_stores(db: AsyncSession) -> list[Store]:
    stmt = select(Store).where(Store.active.is_(True)).order_by(Store.id)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_first_store_id(db: AsyncSession) -> int | None:
    result = await db.execute(select(Store.id).order_by(Store.id).limit(1))
    return result.scalar_one_or_none()
