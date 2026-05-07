from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.store_display_config import StoreDisplayConfig


def now_taipei_naive() -> datetime:
    return datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)


async def get_store_display_config(db: AsyncSession, store_key: str) -> Optional[StoreDisplayConfig]:
    stmt = select(StoreDisplayConfig).where(StoreDisplayConfig.store_key == store_key)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_store_display_config(
    db: AsyncSession,
    store_key: str,
    visible_fields: list[str],
    updated_by_staff_id: int | None = None,
) -> StoreDisplayConfig:
    config = StoreDisplayConfig(
        store_key=store_key,
        visible_fields=visible_fields,
        updated_by_staff_id=updated_by_staff_id,
    )
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config


async def save_store_display_config(
    db: AsyncSession,
    config: StoreDisplayConfig,
    visible_fields: list[str],
    updated_by_staff_id: int | None = None,
) -> StoreDisplayConfig:
    config.visible_fields = visible_fields
    config.updated_by_staff_id = updated_by_staff_id
    config.updated_at = now_taipei_naive()
    db.add(config)
    await db.commit()
    await db.refresh(config)
    return config

