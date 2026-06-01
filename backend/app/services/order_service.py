# app/services/order_service.py

from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.time import to_taipei_aware, to_taipei_naive
from app.enums.chat import ChatMessageDirection, ChatMessageStatus, ChatRoomStage
from app.enums.order import OrderStatus
from app.enums.payment import PaymentStatus
from app.enums.shipment import ShipmentMethod
from app.models.chat import ChatMessage
from app.models.order import Order, OrderDraft
from app.repositories.order_repository import (
    get_latest_confirmed_order_by_room,
    get_latest_order_draft_by_room,
    get_order_by_id,
    list_all_orders,
    now_taipei_naive,
    save_order,
    save_order_draft,
)
from app.schemas.chat import ChatMessagePayload
from app.schemas.order import OrderDraftOut, OrderDraftUpdate, OrderOut
from app.services.message_service import get_chat_room_by_room_id
from app.services.payment_service import get_pay_way_by_order_id, get_payment_method_by_id
from app.services.user_service import (
    get_line_uid_by_chatroom_id,
    get_user_by_id,
    update_user_info,
)
from app.utils.line_send_message import LINE_push_message


async def get_order(db: AsyncSession, order_id: int) -> Order:
    return await get_order_by_id(db, order_id)


async def _build_order_out(db: AsyncSession, order: Order) -> Optional[OrderOut]:
    pay_way = await get_pay_way_by_order_id(db, order.id)
    shipment = order.shipment_method or ShipmentMethod.STORE_PICKUP
    quantity = order.quantity if order.quantity is not None else 0

    return OrderOut(
        id=order.id,
        customer_name=order.customer_name or "",
        customer_phone=order.customer_phone or "",
        order_date=to_taipei_aware(order.created_at),
        order_status=order.status,
        pay_way=order.pay_way or (pay_way.display_name if pay_way else None),
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


async def get_all_orders(db: AsyncSession) -> Optional[List[OrderOut]]:
    results: list[OrderOut] = []
    for order in await list_all_orders(db):
        out = await _build_order_out(db, order)
        if out:
            results.append(out)
    results.sort(key=lambda x: x.id, reverse=True)
    return results


async def validate_order_draft_required_fields(
    db: AsyncSession, order_draft: OrderDraft
) -> tuple[bool, list[str]]:
    if not order_draft:
        return False, ["order_draft"]

    missing_fields: list[str] = []
    for field in ("customer_id", "item_type", "total_amount", "delivery_datetime"):
        value = getattr(order_draft, field, None)
        if field == "total_amount":
            if value is None or value <= 0:
                missing_fields.append(field)
            continue
        if value is None:
            missing_fields.append(field)

    customer = await get_user_by_id(db, order_draft.customer_id)
    if not customer:
        missing_fields.append("customer")
    else:
        if not customer.name:
            missing_fields.append("customer_name")
        if not customer.phone:
            missing_fields.append("customer_phone")

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
        LINE_push_message(line_uid, ChatMessagePayload(text=msg))
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
    return True


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
        draft_in.customer_name is not None or draft_in.customer_phone is not None
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
            name=draft_in.customer_name or customer.name,
            phone=draft_in.customer_phone or customer.phone,
        )

    if draft_in.item is not None:
        order_draft.item_type = draft_in.item
    if draft_in.quantity is not None:
        order_draft.quantity = draft_in.quantity
    if draft_in.total_amount is not None:
        order_draft.total_amount = draft_in.total_amount
    if draft_in.note is not None:
        order_draft.notes = draft_in.note
    if draft_in.shipment_method is not None:
        order_draft.shipment_method = draft_in.shipment_method
    if draft_in.send_datetime is not None:
        order_draft.delivery_datetime = to_taipei_naive(draft_in.send_datetime)
    if draft_in.delivery_address is not None:
        order_draft.delivery_address = draft_in.delivery_address
    if draft_in.pay_way is not None:
        order_draft.pay_way = draft_in.pay_way
    if draft_in.pay_status is not None:
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
