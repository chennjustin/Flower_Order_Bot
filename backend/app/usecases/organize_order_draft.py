from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.llm.openai_chat import complete_system_prompt
from app.enums.chat import ChatMessageDirection, ChatMessageStatus
from app.enums.payment import PaymentStatus
from app.models.chat import ChatMessage, ChatRoom
from app.schemas.chat import ChatMessagePayload
from app.schemas.order import OrderDraftOut, OrderDraftUpdate
from app.services.order_field_config_service import get_effective_order_field_config
from app.services.order_service import (
    create_order_draft_by_room_id,
    get_order_draft_out_by_room,
    update_order_draft_by_room_id,
)
from app.services.user_service import get_line_uid_by_chatroom_id
from app.utils.line_send_message import LINE_push_message
from app.managers.prompt_manager import PromptManager


prompt_manager = PromptManager()
CORE_REQUIRED_FIELD_LABELS: dict[str, str] = {
    "customer_name": "顧客姓名",
    "customer_phone": "顧客電話",
    "item": "商品項目",
    "send_datetime": "取貨時間",
    "total_amount": "總金額",
}
OPTIONAL_FIELD_LABELS: dict[str, str] = {
    "quantity": "數量",
    "note": "備註",
    "shipment_method": "配送方式",
    "delivery_address": "配送地址",
    "pay_way": "付款方式",
    "pay_status": "付款狀態",
}


def _normalize_payment_status(value: object) -> PaymentStatus | None:
    if value is None:
        return None
    if isinstance(value, PaymentStatus):
        return value
    text = str(value).strip().upper()
    if not text:
        return None
    aliases = {
        "PENDING": PaymentStatus.PENDING,
        "UNPAID": PaymentStatus.PENDING,
        "未付款": PaymentStatus.PENDING,
        "PAID": PaymentStatus.PAID,
        "已付款": PaymentStatus.PAID,
        "FAILED": PaymentStatus.FAILED,
        "付款失敗": PaymentStatus.FAILED,
        "REFUNDED": PaymentStatus.REFUNDED,
        "已退款": PaymentStatus.REFUNDED,
    }
    return aliases.get(text)


def _clean_parsed_reply(parsed_reply: dict) -> dict:
    for key, value in parsed_reply.items():
        if isinstance(value, str) and value.strip() == "":
            parsed_reply[key] = None
        if isinstance(value, datetime):
            parsed_reply[key] = value.replace(tzinfo=None)
    return parsed_reply


def _parse_order_draft_json(gpt_reply: str) -> OrderDraftUpdate | None:
    if not gpt_reply or gpt_reply.strip() == "":
        return None
    parsed_reply = _clean_parsed_reply(json.loads(gpt_reply))
    return OrderDraftUpdate(
        # 整理流程不允許 AI 覆蓋 customer 資料；姓名/電話永遠以 customer 表為準。
        customer_name=None,
        customer_phone=None,
        pay_way=parsed_reply.get("pay_way"),
        total_amount=parsed_reply.get("total_amount"),
        item=parsed_reply.get("item"),
        quantity=parsed_reply.get("quantity"),
        note=parsed_reply.get("note"),
        shipment_method=parsed_reply.get("shipment_method"),
        pay_status=_normalize_payment_status(parsed_reply.get("pay_status")),
        send_datetime=parsed_reply.get("send_datetime"),
        delivery_address=parsed_reply.get("delivery_address"),
    )


def _collect_missing_fields(
    draft: OrderDraftOut,
    order_draft_update: OrderDraftUpdate,
    required_fields: set[str],
) -> list[str]:
    effective_values = {
        "customer_name": order_draft_update.customer_name or draft.customer_name,
        "customer_phone": order_draft_update.customer_phone or draft.customer_phone,
        "item": order_draft_update.item or draft.item,
        "send_datetime": order_draft_update.send_datetime or draft.send_datetime,
        "total_amount": (
            order_draft_update.total_amount
            if order_draft_update.total_amount is not None
            else draft.total_amount
        ),
        "quantity": (
            order_draft_update.quantity
            if order_draft_update.quantity is not None
            else draft.quantity
        ),
        "note": order_draft_update.note or draft.note,
        "shipment_method": order_draft_update.shipment_method or draft.shipment_method,
        "delivery_address": order_draft_update.delivery_address or draft.delivery_address,
        "pay_way": order_draft_update.pay_way or draft.pay_way,
        "pay_status": order_draft_update.pay_status or draft.pay_status,
    }

    missing_labels: list[str] = []
    label_map = {**CORE_REQUIRED_FIELD_LABELS, **OPTIONAL_FIELD_LABELS}
    for field, label in label_map.items():
        if field not in required_fields:
            continue
        value = effective_values.get(field)
        if field in {"total_amount", "quantity"}:
            # total_amount <= 0 視同未填（LLM 預設常為 -1）。
            if value is None or value <= 0:
                missing_labels.append(label)
            continue
        if value in (None, ""):
            missing_labels.append(label)
    return missing_labels


def _filter_update_by_required_fields(
    order_draft_update: OrderDraftUpdate, required_fields: set[str]
) -> OrderDraftUpdate:
    optional_to_clear = {
        "quantity": None,
        "note": None,
        "shipment_method": None,
        "delivery_address": None,
        "pay_way": None,
        "pay_status": None,
    }
    payload = order_draft_update.model_dump()
    for field_name, default_value in optional_to_clear.items():
        if field_name not in required_fields:
            payload[field_name] = default_value
    return OrderDraftUpdate(**payload)


async def organize_order_draft(db: AsyncSession, chat_room_id: int) -> OrderDraftOut:
    result = await db.execute(select(ChatRoom).where(ChatRoom.id == chat_room_id))
    chat_room = result.scalars().first()
    if not chat_room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到聊天室")
    field_config = await get_effective_order_field_config(db, chat_room.store_id)

    draft = await get_order_draft_out_by_room(db, chat_room.id)
    if not draft:
        await create_order_draft_by_room_id(db, room_id=chat_room.id)
        draft = await get_order_draft_out_by_room(db, chat_room.id)

    stmt = (
        select(ChatMessage)
        .where(ChatMessage.room_id == chat_room_id, ChatMessage.processed == False)
        .order_by(ChatMessage.created_at.asc())
    )
    messages_result = await db.execute(stmt)
    messages = messages_result.scalars().all()

    combined_text = "\n".join(
        reversed(
            [
                f"[{m.created_at.strftime('%Y-%m-%d %H:%M:%S')}] {m.text} {m.direction}"
                for m in messages
            ]
        )
    )

    gpt_prompt = prompt_manager.load_prompt(
        "order_prompt",
        user_message=combined_text,
        order_draft=json.dumps(draft.model_dump_json()) or {},
    )
    print("🔍 GPT 處理中...")
    print(f"📜 GPT Prompt:\n{gpt_prompt}")

    gpt_reply = complete_system_prompt(gpt_prompt, model="gpt-4.1", temperature=0)

    print("🔍 GPT 處理完成")
    print(f"💬 GPT 回覆:\n{gpt_reply}")

    order_draft_update = _parse_order_draft_json(gpt_reply)
    if not order_draft_update:
        print("❗ GPT 回覆為空，無法解析")
        return None

    print(order_draft_update)

    required_fields = set(field_config.organize_required_fields)
    order_draft_update = _filter_update_by_required_fields(order_draft_update, required_fields)
    missing_fields = _collect_missing_fields(draft, order_draft_update, required_fields)

    if missing_fields:
        warning_msg = (
            "智慧客服已根據對話內容整理好訂單草稿囉！"
            "我們發現了一些缺少的資料，請幫我們直接在下方補上～\n"
            + "\n".join(f"- {f}" for f in missing_fields)
        )
        print(warning_msg)

        line_uid = await get_line_uid_by_chatroom_id(db, chat_room.id)
        if line_uid:
            LINE_push_message(line_uid, ChatMessagePayload(text=warning_msg))
        else:
            print("❗ 無法取得 LINE UID，無法推播缺漏提醒。")

        tz = timezone(timedelta(hours=8))
        message = ChatMessage(
            room_id=chat_room.id,
            direction=ChatMessageDirection.OUTGOING_BY_BOT,
            text="[自動回覆已傳送]" + warning_msg,
            image_url=None,
            sticker_package_id=None,
            sticker_id=None,
            status=ChatMessageStatus.PENDING,
            processed=True,
            created_at=datetime.now(tz).replace(tzinfo=None),
            updated_at=datetime.now(tz).replace(tzinfo=None),
        )
        db.add(message)
        await db.commit()

    order_draft_out = await update_order_draft_by_room_id(
        db=db,
        room_id=chat_room.id,
        draft_in=order_draft_update,
        allow_customer_update=False,
    )

    stmt = (
        update(ChatMessage)
        .where(ChatMessage.id.in_([m.id for m in messages]))
        .values(processed=True)
    )
    await db.execute(stmt)
    await db.commit()

    return order_draft_out

