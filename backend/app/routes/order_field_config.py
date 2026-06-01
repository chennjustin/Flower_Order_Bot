from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_store
from app.core.database import get_db
from app.models.store import Store
from app.schemas.order_field_config import OrderFieldConfigOut, OrderFieldConfigUpdate
from app.services.order_field_config_service import (
    get_order_field_config,
    update_order_field_config,
)

api_router = APIRouter()


def _assert_own_store(store_id: int, store: Store) -> None:
    """禁止存取他人 store（路徑帶 store_id 時需與登入者的 store 相符）。"""
    if store_id != store.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only access your own store.",
        )


@api_router.get("/stores/{store_id}/order-field-config", response_model=OrderFieldConfigOut)
async def get_store_order_field_config(
    store_id: int,
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
) -> OrderFieldConfigOut:
    _assert_own_store(store_id, store)
    return await get_order_field_config(db, store_id)


@api_router.put("/stores/{store_id}/order-field-config", response_model=OrderFieldConfigOut)
async def put_store_order_field_config(
    store_id: int,
    payload: OrderFieldConfigUpdate,
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
) -> OrderFieldConfigOut:
    _assert_own_store(store_id, store)
    return await update_order_field_config(db, store_id, payload)


@api_router.get("/store/order-field-config/default", response_model=OrderFieldConfigOut)
async def get_default_store_order_field_config(
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
) -> OrderFieldConfigOut:
    return await get_order_field_config(db, store.id)


@api_router.put("/store/order-field-config/default", response_model=OrderFieldConfigOut)
async def put_default_store_order_field_config(
    payload: OrderFieldConfigUpdate,
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
) -> OrderFieldConfigOut:
    return await update_order_field_config(db, store.id, payload)
