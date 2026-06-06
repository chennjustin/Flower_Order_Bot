from datetime import date, datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_chat_room_for_store, get_current_store, get_order_for_store
from app.core.database import get_db
from app.models.store import Store
from app.schemas.order import (
    OrderDraftOut,
    OrderDraftUpdate,
    OrderListOut,
    OrderOut,
    OrderPatchUpdate,
    OrderStatusUpdate,
    OrderSuggestFromChatOut,
)
from app.services.order_service import (
    build_order_list_filters,
    create_order_by_room,
    create_order_direct,
    delete_order_by_id,
    export_orders_csv,
    get_order_draft_out_by_room,
    get_orders_by_room_id,
    get_orders_page,
    update_order_by_room_id,
    update_order_draft_by_room_id,
    update_order_fields_by_id,
    update_order_status_by_id,
)
from app.usecases.suggest_order_from_chat import suggest_order_from_chat

api_router = APIRouter()


@api_router.get("/orders", response_model=OrderListOut)
async def get_orders(
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    status: Optional[str] = Query(None, pattern="^(in_progress|completed)$"),
    pickup_date: Optional[date] = None,
    pickup_from: Optional[datetime] = None,
    pickup_to: Optional[datetime] = None,
    q: Optional[str] = None,
    include_cancelled: bool = False,
):
    filters = build_order_list_filters(
        store.id,
        status=status,
        pickup_date=pickup_date,
        pickup_from=pickup_from,
        pickup_to=pickup_to,
        q=q,
        include_cancelled=include_cancelled,
    )
    return await get_orders_page(db, filters, page=page, page_size=page_size)


@api_router.get("/orders/export.csv", response_class=PlainTextResponse)
async def export_orders(
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
    status: Optional[str] = Query(None, pattern="^(in_progress|completed)$"),
    pickup_date: Optional[date] = None,
    pickup_from: Optional[datetime] = None,
    pickup_to: Optional[datetime] = None,
    q: Optional[str] = None,
    include_cancelled: bool = False,
):
    filters = build_order_list_filters(
        store.id,
        status=status,
        pickup_date=pickup_date,
        pickup_from=pickup_from,
        pickup_to=pickup_to,
        q=q,
        include_cancelled=include_cancelled,
    )
    csv_text = await export_orders_csv(db, filters)
    return PlainTextResponse(
        content="\ufeff" + csv_text,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="orders.csv"'},
    )


@api_router.post("/orders/direct", response_model=OrderOut)
async def create_order_direct_route(
    body: OrderPatchUpdate,
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    return await create_order_direct(db, store.id, body)


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
