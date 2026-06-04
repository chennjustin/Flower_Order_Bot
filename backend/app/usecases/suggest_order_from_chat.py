from __future__ import annotations

import json

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.llm.openai_chat import complete_system_prompt
from app.enums.order import OrderStatus
from app.models.chat import ChatMessage
from app.repositories.order_repository import get_order_by_id
from app.schemas.order import OrderDraftUpdate, OrderOut, OrderPatchUpdate, OrderSuggestFromChatOut
from app.services.order_field_config_service import get_effective_order_field_config
from app.services.order_service import _build_order_out
from app.services.message_service import get_chat_room_by_room_id
from app.managers.prompt_manager import PromptManager
from app.usecases.organize_order_draft import (
    _filter_update_by_required_fields,
    _parse_order_draft_json,
)


prompt_manager = PromptManager()


def _build_combined_chat_text(messages: list[ChatMessage]) -> str:
    return "\n".join(
        reversed(
            [
                f"[{m.created_at.strftime('%Y-%m-%d %H:%M:%S')}] {m.text} {m.direction}"
                for m in messages
            ]
        )
    )


def _order_out_to_prompt_json(order_out: OrderOut) -> str:
    payload = order_out.model_dump(mode="json")
    return json.dumps(payload, ensure_ascii=False)


def _merge_llm_update_into_patch(order_out: OrderOut, update: OrderDraftUpdate) -> OrderPatchUpdate:
    """Build a full PATCH body from current order plus LLM deltas."""

    def pick_str(current: str | None, new: str | None) -> str | None:
        return new if new is not None else current

    def pick_num(current: float | int | None, new: float | int | None) -> float | int | None:
        return new if new is not None else current

    return OrderPatchUpdate(
        customer_name=order_out.customer_name,
        customer_phone=order_out.customer_phone,
        total_amount=pick_num(order_out.total_amount, update.total_amount),
        pay_status=update.pay_status if update.pay_status is not None else order_out.pay_status,
        item=pick_str(order_out.item, update.item),
        quantity=pick_num(order_out.quantity, update.quantity),
        note=pick_str(order_out.note, update.note),
        shipment_method=update.shipment_method or order_out.shipment_method,
        send_datetime=update.send_datetime or order_out.send_datetime,
        delivery_address=pick_str(order_out.delivery_address, update.delivery_address),
        pay_way=pick_str(order_out.pay_way, update.pay_way),
        order_status=order_out.order_status,
    )


async def suggest_order_from_chat(db: AsyncSession, order_id: int) -> OrderSuggestFromChatOut:
    order = await get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found.",
        )
    if order.status == OrderStatus.CANCELLED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot suggest updates for a cancelled order.",
        )

    room = await get_chat_room_by_room_id(db, order.room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat room {order.room_id} not found.",
        )

    order_out = await _build_order_out(db, order)
    if not order_out:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to build order response for id {order_id}.",
        )

    stmt = (
        select(ChatMessage)
        .where(ChatMessage.room_id == order.room_id, ChatMessage.processed == False)
        .order_by(ChatMessage.created_at.asc())
    )
    messages_result = await db.execute(stmt)
    messages = list(messages_result.scalars().all())
    source_message_ids = [m.id for m in messages]

    combined_text = _build_combined_chat_text(messages)
    gpt_prompt = prompt_manager.load_prompt(
        "order_update_prompt",
        user_message=combined_text,
        current_order=_order_out_to_prompt_json(order_out),
    )

    gpt_reply = complete_system_prompt(gpt_prompt, model="gpt-4.1", temperature=0)
    order_draft_update = _parse_order_draft_json(gpt_reply)
    if not order_draft_update:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="LLM returned empty or invalid JSON.",
        )

    field_config = await get_effective_order_field_config(db, room.store_id)
    required_fields = set(field_config.organize_required_fields)
    order_draft_update = _filter_update_by_required_fields(order_draft_update, required_fields)
    suggested = _merge_llm_update_into_patch(order_out, order_draft_update)

    return OrderSuggestFromChatOut(
        suggested=suggested,
        source_message_ids=source_message_ids,
    )
