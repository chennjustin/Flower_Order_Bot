# app/services/order_service.py

from __future__ import annotations

import logging
import csv
import io
from datetime import date, datetime
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import to_taipei_aware, to_taipei_naive
from app.enums.chat import ChatMessageDirection, ChatMessageStatus, ChatRoomStage
from app.enums.order import OrderStatus
from app.enums.payment import PaymentStatus
from app.enums.shipment import ShipmentMethod
from app.models.chat import ChatMessage
from app.models.order import Order, OrderDraft
from app.repositories.order_repository import (
    OrderListFilters,
    count_orders_filtered,
    get_latest_confirmed_order_by_room,
    get_latest_order_draft_by_room,
    get_order_by_id,
    list_all_orders,
    list_orders_by_customer_id,
    list_orders_filtered,
    now_taipei_naive,
    save_order,
    save_order_draft,
)
from app.schemas.chat import ChatMessagePayload
from app.schemas.order import (
    OrderDraftOut,
    OrderDraftUpdate,
    OrderListOut,
    OrderOut,
    OrderPatchUpdate,
)
from app.services.message_service import get_chat_room_by_room_id
from app.services.order_field_config_service import get_effective_order_field_config
from app.services.order_field_values import (
    collect_missing_catalog_keys,
    order_draft_catalog_values,
)
from app.repositories.payment_repository import get_payment_methods_by_order_ids
from app.services.payment_service import get_pay_way_by_order_id, get_payment_method_by_id
from app.services.user_service import (
    get_line_uid_by_chatroom_id,
    get_user_by_id,
    update_user_info,
)
from app.core.line_client import line_bot_api_for_store
from app.repositories.store_repository import get_store_by_id
from app.services.google_calendar_service import (
    delete_order_event,
    is_connected,
    sync_order_event,
)
from app.utils.line_send_message import LINE_push_message

logger = logging.getLogger(__name__)


async def _sync_order_to_calendar(db: AsyncSession, order: Order, *, delete: bool = False) -> None:
    """Best-effort: mirror an order onto the store owner's Google Calendar.

    Resolves the store via the order's chat room. Never raises — a calendar
    problem must not break the order operation that triggered it.
    """
    try:
        room = await get_chat_room_by_room_id(db, order.room_id)
        if not room:
            return
        store = await get_store_by_id(db, room.store_id)
        if not store or not is_connected(store):
            return
        if delete:
            await delete_order_event(db, store, order)
        else:
            await sync_order_event(db, store, order)
    except Exception:
        logger.exception("Calendar sync skipped for order %s", getattr(order, "id", "?"))


async def get_order(db: AsyncSession, order_id: int) -> Order:
    return await get_order_by_id(db, order_id)


async def get_order_out_by_id(db: AsyncSession, order_id: int) -> Optional[OrderOut]:
    order = await get_order_by_id(db, order_id)
    if not order:
        return None
    return await _build_order_out(db, order)


def _order_to_out(order: Order, pay_way_map: dict[int, object]) -> OrderOut:
    pay_method = pay_way_map.get(order.id)
    shipment = order.shipment_method or ShipmentMethod.STORE_PICKUP
    quantity = order.quantity if order.quantity is not None else 0
    pay_way_name = order.pay_way or (
        getattr(pay_method, "display_name", None) if pay_method else None
    )

    return OrderOut(
        id=order.id,
        customer_name=order.customer_name or "",
        customer_phone=order.customer_phone or "",
        order_date=to_taipei_aware(order.created_at),
        order_status=order.status,
        pay_way=pay_way_name,
        pay_status=order.pay_status or PaymentStatus.PENDING,
        total_amount=float(order.total_amount),
        item=order.item_type,
        quantity=quantity,
        note=order.notes,
        shipment_method=shipment,
        send_datetime=(
            to_taipei_aware(order.delivery_datetime) if order.delivery_datetime else None
        ),
        delivery_address=order.delivery_address or "",
    )


async def _build_orders_out_batch(
    db: AsyncSession, orders: list[Order]
) -> list[OrderOut]:
    if not orders:
        return []
    pay_way_map = await get_payment_methods_by_order_ids(db, [o.id for o in orders])
    return [_order_to_out(order, pay_way_map) for order in orders]


async def _build_order_out(db: AsyncSession, order: Order) -> Optional[OrderOut]:
    batch = await _build_orders_out_batch(db, [order])
    return batch[0] if batch else None


def build_order_list_filters(
    store_id: int,
    *,
    status: Optional[str] = None,
    pickup_date: Optional[date] = None,
    pickup_from: Optional[datetime] = None,
    pickup_to: Optional[datetime] = None,
    q: Optional[str] = None,
    include_cancelled: bool = False,
) -> OrderListFilters:
    return OrderListFilters(
        store_id=store_id,
        status=status or None,
        pickup_date=pickup_date,
        pickup_from=pickup_from,
        pickup_to=pickup_to,
        q=q,
        include_cancelled=include_cancelled,
    )


async def get_orders_page(
    db: AsyncSession,
    filters: OrderListFilters,
    *,
    page: int = 1,
    page_size: int = 20,
) -> OrderListOut:
    page = max(1, page)
    page_size = max(1, min(page_size, 200))
    total = await count_orders_filtered(db, filters)
    orders = await list_orders_filtered(
        db,
        filters,
        limit=page_size,
        offset=(page - 1) * page_size,
    )
    items = await _build_orders_out_batch(db, orders)
    return OrderListOut(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


async def export_orders_csv(db: AsyncSession, filters: OrderListFilters) -> str:
    orders = await list_orders_filtered(db, filters)
    items = await _build_orders_out_batch(db, orders)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        [
            "訂單編號",
            "顧客姓名",
            "顧客電話",
            "狀態",
            "品項",
            "數量",
            "總金額",
            "取貨時間",
            "備註",
        ]
    )
    for row in items:
        writer.writerow(
            [
                row.id,
                row.customer_name,
                row.customer_phone,
                row.order_status.value,
                row.item,
                row.quantity,
                row.total_amount,
                row.send_datetime.isoformat() if row.send_datetime else "",
                row.note or "",
            ]
        )
    return buffer.getvalue()


async def get_all_orders(
    db: AsyncSession, store_id: int | None = None
) -> Optional[List[OrderOut]]:
    if store_id is None:
        orders = await list_all_orders(db, store_id=None)
    else:
        filters = build_order_list_filters(store_id, include_cancelled=True)
        orders = await list_orders_filtered(db, filters)
    items = await _build_orders_out_batch(db, orders)
    items.sort(key=lambda x: x.id, reverse=True)
    return items


async def get_orders_by_room_id(db: AsyncSession, room_id: int) -> List[OrderOut]:
    """Return all orders (including cancelled) for the customer linked to this chat room."""
    room = await get_chat_room_by_room_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat room {room_id} not found.",
        )

    results: list[OrderOut] = []
    for order in await list_orders_by_customer_id(db, room.customer_id):
        out = await _build_order_out(db, order)
        if out:
            results.append(out)
    return results


async def validate_order_draft_required_fields(
    db: AsyncSession, order_draft: OrderDraft
) -> tuple[bool, list[str]]:
    if not order_draft:
        return False, ["order_draft"]

    room = await get_chat_room_by_room_id(db, order_draft.room_id)
    if not room:
        return False, ["order_draft"]

    field_config = await get_effective_order_field_config(db, room.store_id)
    customer = await get_user_by_id(db, order_draft.customer_id)

    effective_values = order_draft_catalog_values(order_draft, customer)
    missing_fields = collect_missing_catalog_keys(
        effective_values, field_config.organize_required_fields
    )
    return len(missing_fields) == 0, missing_fields


async def create_order_by_room(db: AsyncSession, room_id: int) -> list[str]:
    room = await get_chat_room_by_room_id(db, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat room {room_id} not found.")

    order_draft = await get_order_draft_by_room(db, room_id)
    if not order_draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order draft for room {room_id} not found.",
        )

    is_complete, missing_fields = await validate_order_draft_required_fields(db, order_draft)
    if not is_complete:
        return missing_fields
    customer = await get_user_by_id(db, order_draft.customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with id {order_draft.customer_id} not found.",
        )

    order = Order(
        room_id=order_draft.room_id,
        customer_id=order_draft.customer_id,
        status=OrderStatus.CONFIRMED,
        customer_name=customer.name,
        customer_phone=customer.phone or "",
        item_type=order_draft.item_type,
        quantity=order_draft.quantity,
        total_amount=order_draft.total_amount,
        notes=order_draft.notes,
        shipment_method=order_draft.shipment_method,
        pay_way=order_draft.pay_way,
        pay_status=order_draft.pay_status or PaymentStatus.PENDING,
        delivery_address=order_draft.delivery_address,
        delivery_datetime=order_draft.delivery_datetime,
        created_at=now_taipei_naive(),
        updated_at=now_taipei_naive(),
    )
    await save_order(db, order)

    room.stage = ChatRoomStage.ORDER_CONFIRM
    await db.commit()
    await db.refresh(room)

    line_uid = await get_line_uid_by_chatroom_id(db, room.id)
    msg = "訂單已經由後台送出囉～\n\n"
    if line_uid:
        store = await get_store_by_id(db, room.store_id)
        if store:
            line_api = line_bot_api_for_store(store)
            LINE_push_message(line_api, line_uid, ChatMessagePayload(text=msg))
    else:
        print("❗ 無法取得 LINE UID，無法推播訂單已送出提醒。")
    db.add(
        ChatMessage(
            room_id=room.id,
            direction=ChatMessageDirection.OUTGOING_BY_BOT,
            text="[自動回覆已傳送]" + msg,
            image_url="",
            status=ChatMessageStatus.PENDING,
            processed=True,
            created_at=now_taipei_naive(),
            updated_at=now_taipei_naive(),
        )
    )
    await db.commit()
    await _sync_order_to_calendar(db, order)
    return []


async def update_order_by_room_id(db: AsyncSession, room_id: int) -> bool:
    room = await get_chat_room_by_room_id(db, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat room {room_id} not found.")

    order_draft = await get_order_draft_by_room(db, room_id)
    if not order_draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order draft for room {room_id} not found.",
        )

    is_complete, missing = await validate_order_draft_required_fields(db, order_draft)
    if not is_complete:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"訂單草稿不完整，缺少：{', '.join(missing)}",
        )

    order = await get_latest_confirmed_order_by_room(db, room.id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No confirmed order found for room {room_id}.",
        )

    order.customer_id = order_draft.customer_id
    customer = await get_user_by_id(db, order_draft.customer_id)
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer with id {order_draft.customer_id} not found.",
        )
    order.customer_name = customer.name
    order.customer_phone = customer.phone or ""
    order.item_type = order_draft.item_type
    order.quantity = order_draft.quantity
    order.total_amount = order_draft.total_amount
    order.notes = order_draft.notes
    order.shipment_method = order_draft.shipment_method
    order.pay_way = order_draft.pay_way
    order.pay_status = order_draft.pay_status
    order.delivery_address = order_draft.delivery_address
    order.delivery_datetime = order_draft.delivery_datetime
    order.updated_at = now_taipei_naive()

    db.add(order)
    await db.commit()
    await db.refresh(order)
    await _sync_order_to_calendar(db, order)
    return True


async def delete_order_by_id(db: AsyncSession, order_id: int) -> bool:
    order = await get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found.",
        )
    order.status = OrderStatus.CANCELLED
    await db.commit()
    await db.refresh(order)
    await _sync_order_to_calendar(db, order, delete=True)
    return True


async def _mark_chat_messages_processed(
    db: AsyncSession, room_id: int, message_ids: list[int]
) -> None:
    if not message_ids:
        return
    stmt = (
        update(ChatMessage)
        .where(
            ChatMessage.id.in_(message_ids),
            ChatMessage.room_id == room_id,
        )
        .values(processed=True)
    )
    await db.execute(stmt)


async def create_order_direct(
    db: AsyncSession, store_id: int, patch: OrderPatchUpdate
) -> OrderOut:
    """Create a standalone order not tied to a chat room draft."""
    order = Order(
        room_id=None,
        customer_id=None,
        store_id=store_id,
        status=patch.order_status or OrderStatus.CONFIRMED,
        customer_name=patch.customer_name,
        customer_phone=patch.customer_phone,
        item_type=patch.item or "",
        quantity=patch.quantity,
        total_amount=patch.total_amount or 0,
        notes=patch.note,
        shipment_method=patch.shipment_method,
        pay_way=patch.pay_way,
        pay_status=patch.pay_status or PaymentStatus.PENDING,
        delivery_address=patch.delivery_address,
        delivery_datetime=(
            to_taipei_naive(patch.send_datetime) if patch.send_datetime else None
        ),
        created_at=now_taipei_naive(),
        updated_at=now_taipei_naive(),
    )
    db.add(order)
    await db.commit()
    await db.refresh(order)
    out = await _build_order_out(db, order)
    if not out:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to build order response.",
        )
    return out


async def update_order_fields_by_id(
    db: AsyncSession, order_id: int, patch: OrderPatchUpdate
) -> OrderOut:
    order = await get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found.",
        )

    message_ids_to_mark = patch.mark_processed_message_ids or []

    # Nullable columns: explicit null clears the stored value.
    if _patch_field_was_sent(patch, "customer_name"):
        order.customer_name = patch.customer_name
    if _patch_field_was_sent(patch, "customer_phone"):
        order.customer_phone = patch.customer_phone
    if _patch_field_was_sent(patch, "quantity"):
        order.quantity = patch.quantity
    if _patch_field_was_sent(patch, "note"):
        order.notes = patch.note
    if _patch_field_was_sent(patch, "send_datetime"):
        order.delivery_datetime = (
            to_taipei_naive(patch.send_datetime) if patch.send_datetime else None
        )
    if _patch_field_was_sent(patch, "delivery_address"):
        order.delivery_address = patch.delivery_address
    if _patch_field_was_sent(patch, "pay_way"):
        order.pay_way = patch.pay_way

    # NOT NULL columns: ignore explicit null — keep the existing value.
    if _patch_field_was_sent(patch, "item") and patch.item is not None:
        order.item_type = patch.item
    if _patch_field_was_sent(patch, "total_amount") and patch.total_amount is not None:
        order.total_amount = patch.total_amount

    # Enums / status: only apply when a concrete value is sent.
    if patch.shipment_method is not None:
        order.shipment_method = patch.shipment_method
    if patch.pay_status is not None:
        order.pay_status = patch.pay_status
    if patch.order_status is not None:
        order.status = patch.order_status

    order.updated_at = now_taipei_naive()
    db.add(order)
    await _mark_chat_messages_processed(db, order.room_id, message_ids_to_mark)
    await db.commit()
    await db.refresh(order)

    if order.status == OrderStatus.CANCELLED:
        await _sync_order_to_calendar(db, order, delete=True)
    else:
        await _sync_order_to_calendar(db, order)

    out = await _build_order_out(db, order)
    if not out:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to build order response for id {order_id}.",
        )
    return out


async def update_order_status_by_id(
    db: AsyncSession, order_id: int, new_status: OrderStatus
) -> OrderOut:
    order = await get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found.",
        )

    order.status = new_status
    order.updated_at = now_taipei_naive()
    db.add(order)
    await db.commit()
    await db.refresh(order)

    if order.status == OrderStatus.CANCELLED:
        await _sync_order_to_calendar(db, order, delete=True)
    else:
        await _sync_order_to_calendar(db, order)

    out = await _build_order_out(db, order)
    if not out:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to build order response for id {order_id}.",
        )
    return out


async def get_order_draft_by_room(db: AsyncSession, room_id: int) -> Optional[OrderDraft]:
    return await get_latest_order_draft_by_room(db, room_id)


async def get_order_draft_out_by_room(db: AsyncSession, room_id: int) -> Optional[OrderDraftOut]:
    order_draft = await get_latest_order_draft_by_room(db, room_id)
    if not order_draft:
        return None

    customer = await get_user_by_id(db, order_draft.customer_id)

    return OrderDraftOut(
        id=order_draft.id,
        customer_name=customer.name if customer else "未知",
        customer_phone=customer.phone if customer else "未知",
        order_date=to_taipei_aware(order_draft.created_at),
        pay_way=order_draft.pay_way,
        pay_status=order_draft.pay_status or PaymentStatus.PENDING,
        total_amount=order_draft.total_amount,
        item=order_draft.item_type,
        quantity=order_draft.quantity,
        note=order_draft.notes,
        shipment_method=order_draft.shipment_method,
        send_datetime=(
            to_taipei_aware(order_draft.delivery_datetime)
            if order_draft.delivery_datetime
            else None
        ),
        delivery_address=order_draft.delivery_address or "",
    )


async def create_order_draft_by_room_id(db: AsyncSession, room_id: int) -> OrderDraft:
    room = await get_chat_room_by_room_id(db, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat room {room_id} not found.")

    if await get_order_draft_by_room(db, room_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order draft for room {room_id} already exists.",
        )

    order_draft = OrderDraft(
        room_id=room.id,
        customer_id=room.customer_id,
        created_at=now_taipei_naive(),
        updated_at=now_taipei_naive(),
    )
    await save_order_draft(db, order_draft)
    return order_draft


def _patch_field_was_sent(patch: OrderDraftUpdate | OrderPatchUpdate, field: str) -> bool:
    """True when the client included this key in the PATCH body (null means clear)."""
    return field in patch.model_fields_set


def _draft_field_was_sent(draft_in: OrderDraftUpdate, field: str) -> bool:
    return _patch_field_was_sent(draft_in, field)


async def update_order_draft_by_room_id(
    db: AsyncSession,
    room_id: int,
    draft_in: OrderDraftUpdate,
    *,
    allow_customer_update: bool = True,
) -> OrderDraftOut:
    room = await get_chat_room_by_room_id(db, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Chat room {room_id} not found.")

    order_draft = await get_order_draft_by_room(db, room_id)
    if not order_draft:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order draft with room id {room_id} not found.",
        )

    if allow_customer_update and (
        _draft_field_was_sent(draft_in, "customer_name")
        or _draft_field_was_sent(draft_in, "customer_phone")
    ):
        customer = await get_user_by_id(db, order_draft.customer_id)
        if not customer:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Customer with id {order_draft.customer_id} not found.",
            )
        await update_user_info(
            db,
            customer.id,
            name=draft_in.customer_name,
            phone=draft_in.customer_phone,
            update_name=_draft_field_was_sent(draft_in, "customer_name"),
            update_phone=_draft_field_was_sent(draft_in, "customer_phone"),
        )

    if _draft_field_was_sent(draft_in, "item"):
        order_draft.item_type = draft_in.item
    if _draft_field_was_sent(draft_in, "quantity"):
        order_draft.quantity = draft_in.quantity
    if _draft_field_was_sent(draft_in, "total_amount"):
        order_draft.total_amount = draft_in.total_amount
    if _draft_field_was_sent(draft_in, "note"):
        order_draft.notes = draft_in.note
    if _draft_field_was_sent(draft_in, "shipment_method"):
        order_draft.shipment_method = draft_in.shipment_method
    if _draft_field_was_sent(draft_in, "send_datetime"):
        order_draft.delivery_datetime = (
            to_taipei_naive(draft_in.send_datetime) if draft_in.send_datetime else None
        )
    if _draft_field_was_sent(draft_in, "delivery_address"):
        order_draft.delivery_address = draft_in.delivery_address
    if _draft_field_was_sent(draft_in, "pay_way"):
        order_draft.pay_way = draft_in.pay_way
    if _draft_field_was_sent(draft_in, "pay_status"):
        order_draft.pay_status = draft_in.pay_status
    order_draft.updated_at = now_taipei_naive()

    if draft_in.pay_way_id:
        pay_way = await get_payment_method_by_id(db, draft_in.pay_way_id)
        if not pay_way:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment method with id {draft_in.pay_way_id} not found.",
            )
        order_draft.pay_way = pay_way.display_name

    db.add(order_draft)
    await db.commit()
    await db.refresh(order_draft)
    return await get_order_draft_out_by_room(db, room_id)
