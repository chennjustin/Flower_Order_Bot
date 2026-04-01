from __future__ import annotations

from datetime import datetime, timedelta, timezone
import json

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.llm.openai_chat import complete_system_prompt
from app.enums.chat import ChatMessageDirection, ChatMessageStatus
from app.models.chat import ChatMessage, ChatRoom
from app.schemas.chat import ChatMessageBase
from app.schemas.order import OrderDraftOut, OrderDraftUpdate
from app.services.order_service import (
    create_order_draft_by_room_id,
    get_order_draft_out_by_room,
    update_order_draft_by_room_id,
)
from app.services.user_service import get_line_uid_by_chatroom_id
from app.utils.line_send_message import LINE_push_message
from app.managers.prompt_manager import PromptManager


prompt_manager = PromptManager()


def _clean_parsed_reply(parsed_reply: dict) -> dict:
    for key, value in parsed_reply.items():
        if isinstance(value, str) and value.strip() == "":
            parsed_reply[key] = None
        if isinstance(value, datetime):
            parsed_reply[key] = value.replace(tzinfo=None)
    return parsed_reply


def _parse_order_draft_json(gpt_reply: str) -> OrderDraftUpdate:
    if not gpt_reply or gpt_reply.strip() == "":
        return None
    parsed_reply = _clean_parsed_reply(json.loads(gpt_reply))
    return OrderDraftUpdate(
        customer_name=parsed_reply.get("customer_name"),
        customer_phone=parsed_reply.get("customer_phone"),
        receiver_name=parsed_reply.get("receiver_name"),
        receiver_phone=parsed_reply.get("receiver_phone"),
        pay_way=parsed_reply.get("pay_way"),
        total_amount=parsed_reply.get("total_amount"),
        item=parsed_reply.get("item"),
        quantity=parsed_reply.get("quantity"),
        note=parsed_reply.get("note"),
        card_message=parsed_reply.get("card_message"),
        shipment_method=parsed_reply.get("shipment_method"),
        send_datetime=parsed_reply.get("send_datetime"),
        receipt_address=parsed_reply.get("receipt_address"),
        delivery_address=parsed_reply.get("delivery_address"),
    )


async def organize_order_draft(db: AsyncSession, chat_room_id: int) -> OrderDraftOut:
    result = await db.execute(select(ChatRoom).where(ChatRoom.id == chat_room_id))
    chat_room = result.scalars().first()
    if not chat_room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到聊天室")

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

    missing_fields: list[str] = []
    required_fields = {
        "customer_name": "顧客姓名",
        "customer_phone": "顧客電話",
        "receiver_name": "收件人姓名",
        "receiver_phone": "收件人電話",
        "pay_way": "付款方式",
        "total_amount": "總金額",
        "item": "商品項目",
        "quantity": "數量",
        "shipment_method": "配送方式",
        "send_datetime": "送達時間",
        "delivery_address": "收件地址",
    }
    for field, label in required_fields.items():
        if getattr(order_draft_update, field, None) in [None, "", 0]:
            missing_fields.append(label)

    if missing_fields:
        warning_msg = (
            "智慧客服已根據對話內容整理好訂單草稿囉！"
            "我們發現了一些缺少的資料，請幫我們直接在下方補上～\n"
            + "\n".join(f"- {f}" for f in missing_fields)
        )
        print(warning_msg)

        line_uid = await get_line_uid_by_chatroom_id(db, chat_room.id)
        if not line_uid:
            print("❗ 無法取得 LINE UID，無法推播缺漏提醒。")

        LINE_push_message(line_uid, ChatMessageBase(text=warning_msg))

        tz = timezone(timedelta(hours=8))
        message = ChatMessage(
            room_id=chat_room.id,
            direction=ChatMessageDirection.OUTGOING_BY_BOT,
            text="[自動回覆已傳送]" + warning_msg,
            image_url="",
            status=ChatMessageStatus.PENDING,
            processed=True,
            created_at=datetime.now(tz).replace(tzinfo=None),
            updated_at=datetime.now(tz).replace(tzinfo=None),
        )
        db.add(message)
        await db.commit()

    order_draft_out = await update_order_draft_by_room_id(
        db=db, room_id=chat_room.id, draft_in=order_draft_update
    )

    stmt = (
        update(ChatMessage)
        .where(ChatMessage.id.in_([m.id for m in messages]))
        .values(processed=True)
    )
    await db.execute(stmt)
    await db.commit()

    return order_draft_out

