from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.store import Store


async def get_first_store_id(db: AsyncSession) -> int | None:
    result = await db.execute(select(Store.id).order_by(Store.id).limit(1))
    return result.scalar_one_or_none()


async def get_seed_store_id(db: AsyncSession) -> int | None:
    """Fake data default store: id=1 (store1), else slug 'store1', else smallest id."""
    result = await db.execute(select(Store.id).where(Store.id == 1).limit(1))
    store_id = result.scalar_one_or_none()
    if store_id is not None:
        return store_id

    result = await db.execute(select(Store.id).where(Store.slug == "store1").limit(1))
    store_id = result.scalar_one_or_none()
    if store_id is not None:
        return store_id

    return await get_first_store_id(db)
