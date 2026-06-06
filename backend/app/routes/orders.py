from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.core.auth import get_chat_room_for_store, get_current_store, get_order_for_store
from app.models.store import Store
from app.services.order_service import (
    create_order_by_room,
    delete_order_by_id,
    get_all_orders,
    get_order_draft_out_by_room,
    get_orders_by_room_id,
    update_order_by_room_id,
    update_order_draft_by_room_id,
    update_order_fields_by_id,
    update_order_status_by_id,
)
from app.core.database import get_db
from app.schemas.order import (
    OrderOut,
    OrderDraftOut,
    OrderDraftUpdate,
    OrderDraftCreate,
    OrderPatchUpdate,
    OrderStatusUpdate,
    OrderSuggestFromChatOut,
)
from app.usecases.suggest_order_from_chat import suggest_order_from_chat
api_router = APIRouter()


@api_router.get("/orders", response_model=Optional[List[OrderOut]])
async def get_orders(
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    return await get_all_orders(db, store_id=store.id)


@api_router.get("/orders/room/{room_id}", response_model=List[OrderOut])
async def get_orders_by_room(room_id: int, db: AsyncSession = Depends(get_db)):
    return await get_orders_by_room_id(db, room_id)


# 刪除 order
@api_router.delete("/order/{order_id}", response_model=bool)
async def delete_order(
    order_id: int,
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    await get_order_for_store(db, order_id, store)
    return await delete_order_by_id(db, order_id)

@api_router.patch("/orders/{order_id}", response_model=OrderOut)
async def patch_order(
    order_id: int,
    body: OrderPatchUpdate,
    db: AsyncSession = Depends(get_db),
):
    return await update_order_fields_by_id(db, order_id, body)


@api_router.post("/orders/{order_id}/suggest-from-chat", response_model=OrderSuggestFromChatOut)
async def suggest_order_from_chat_route(
    order_id: int,
    db: AsyncSession = Depends(get_db),
):
    return await suggest_order_from_chat(db, order_id)


# 更新 order 狀態（店家手動標示）
@api_router.patch("/order/{order_id}/status", response_model=OrderOut)
async def update_order_status(
    order_id: int,
    body: OrderStatusUpdate,
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    await get_order_for_store(db, order_id, store)
    return await update_order_status_by_id(db, order_id, body.status)


@api_router.post("/order/{room_id}", response_model=list[str])
async def create_order(
    room_id: int,
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    await get_chat_room_for_store(db, room_id, store)
    return await create_order_by_room(db, room_id)


@api_router.patch("/order/{room_id}", response_model=bool)
async def update_order(
    room_id: int,
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    await get_chat_room_for_store(db, room_id, store)
    return await update_order_by_room_id(db, room_id)


@api_router.get("/orderdraft/{room_id}", response_model=Optional[OrderDraftOut])
async def get_order_draft(
    room_id: int,
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    await get_chat_room_for_store(db, room_id, store)
    return await get_order_draft_out_by_room(db, room_id)


@api_router.patch("/orderdraft/{room_id}", response_model=Optional[OrderDraftOut])
async def update_order_draft(
    room_id: int,
    order_draft: OrderDraftUpdate,
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    await get_chat_room_for_store(db, room_id, store)
    return await update_order_draft_by_room_id(db, room_id, order_draft)
