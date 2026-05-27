from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repositories.store_repository import get_first_store_id
from app.schemas.order_field_config import OrderFieldConfigOut, OrderFieldConfigUpdate
from app.services.order_field_config_service import (
    get_order_field_config,
    update_order_field_config,
)

api_router = APIRouter()


@api_router.get("/stores/{store_id}/order-field-config", response_model=OrderFieldConfigOut)
async def get_store_order_field_config(
    store_id: int, db: AsyncSession = Depends(get_db)
) -> OrderFieldConfigOut:
    return await get_order_field_config(db, store_id)


@api_router.put("/stores/{store_id}/order-field-config", response_model=OrderFieldConfigOut)
async def put_store_order_field_config(
    store_id: int, payload: OrderFieldConfigUpdate, db: AsyncSession = Depends(get_db)
) -> OrderFieldConfigOut:
    return await update_order_field_config(db, store_id, payload)


@api_router.get("/store/order-field-config/default", response_model=OrderFieldConfigOut)
async def get_default_store_order_field_config(
    db: AsyncSession = Depends(get_db),
) -> OrderFieldConfigOut:
    store_id = await get_first_store_id(db)
    if store_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No store found. Please create store first.",
        )
    return await get_order_field_config(db, store_id)


@api_router.put("/store/order-field-config/default", response_model=OrderFieldConfigOut)
async def put_default_store_order_field_config(
    payload: OrderFieldConfigUpdate,
    db: AsyncSession = Depends(get_db),
) -> OrderFieldConfigOut:
    store_id = await get_first_store_id(db)
    if store_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No store found. Please create store first.",
        )
    return await update_order_field_config(db, store_id, payload)
