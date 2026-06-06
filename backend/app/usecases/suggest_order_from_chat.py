from __future__ import annotations

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.llm.json_extract import JsonExtractError
from app.adapters.llm.openai_chat import (
    DEFAULT_LLM_MODEL,
    LlmServiceUnavailableError,
    complete_system_prompt,
)
from app.enums.order import OrderStatus
from app.models.chat import ChatMessage
from app.repositories.order_repository import get_order_by_id
from app.schemas.order import OrderDraftUpdate, OrderOut, OrderPatchUpdate, OrderSuggestFromChatOut
from app.services.order_field_config_service import get_effective_order_field_config
from app.services.order_service import _build_order_out
from app.services.message_service import get_chat_room_by_room_id
from app.managers.prompt_manager import PromptManager
from app.usecases.organize_order_draft import _filter_update_by_visible_fields
from app.usecases.llm_order_delta import (
    build_chat_text,
    build_order_patch_from_merged,
    compute_changed_fields,
    filter_changed_fields_to_visible,
    merge_delta_into_catalog,
    order_out_to_catalog_values,
    order_visible_baseline_for_llm,
    parse_delta_json,
    reference_now_taipei,
)


prompt_manager = PromptManager()

ORDER_CUSTOMER_IDENTITY_RULES = """- `customer_name`: do not output; fixed from the formal order.
- `customer_phone`: MUST output when new messages mention a phone number (fill empty baseline or replace with a new/corrected number). Use key `customer_phone` only.
  Triggers: customer says "我的電話…", "聯絡我…", or sends digits like 0912345678 / +886912345678.
- `order_date`: do not output; keep existing order date."""


def _load_order_suggest_prompt(
    *,
    order_out: OrderOut,
    visible_fields: set[str],
    combined_text: str,
    message_count: int,
) -> str:
    extraction_rules = prompt_manager.load_prompt(
        "order_extraction_rules",
        reference_now=reference_now_taipei(),
        customer_identity_rules=ORDER_CUSTOMER_IDENTITY_RULES,
    )
    return prompt_manager.load_prompt(
        "order_update_prompt",
        extraction_rules=extraction_rules,
        baseline=order_visible_baseline_for_llm(order_out, visible_fields),
        user_message=combined_text,
        message_count=message_count,
    )


def _merge_llm_update_into_patch(order_out: OrderOut, update) -> OrderPatchUpdate:
    """Backward-compatible wrapper used by existing unit tests."""

    baseline_values = order_out_to_catalog_values(order_out)
    delta = update.model_dump(exclude_unset=True)
    merged = merge_delta_into_catalog(baseline_values, delta, flow="order_suggest")
    return build_order_patch_from_merged(order_out, merged)


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

    baseline_values = order_out_to_catalog_values(order_out)

    if not messages:
        suggested = build_order_patch_from_merged(order_out, baseline_values)
        return OrderSuggestFromChatOut(
            suggested=suggested,
            changed_fields=[],
            source_message_ids=[],
        )

    field_config = await get_effective_order_field_config(db, room.store_id)
    visible_fields = set(field_config.visible_fields)

    combined_text = build_chat_text(messages)
    gpt_prompt = _load_order_suggest_prompt(
        order_out=order_out,
        visible_fields=visible_fields,
        combined_text=combined_text,
        message_count=len(messages),
    )

    try:
        gpt_reply = complete_system_prompt(gpt_prompt, model=DEFAULT_LLM_MODEL, temperature=0)
        delta = parse_delta_json(gpt_reply)
    except JsonExtractError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="LLM returned empty or invalid JSON.",
        ) from exc
    except LlmServiceUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="LLM service unavailable",
        ) from exc

    draft_delta = OrderDraftUpdate(**{k: v for k, v in delta.items() if k in OrderDraftUpdate.model_fields})
    draft_delta = _filter_update_by_visible_fields(draft_delta, visible_fields)
    filtered_delta = draft_delta.model_dump(exclude_unset=True)

    merged_values = merge_delta_into_catalog(baseline_values, filtered_delta, flow="order_suggest")
    changed_fields = filter_changed_fields_to_visible(
        compute_changed_fields(baseline_values, merged_values),
        visible_fields,
    )
    suggested = build_order_patch_from_merged(order_out, merged_values)

    return OrderSuggestFromChatOut(
        suggested=suggested,
        changed_fields=changed_fields,
        source_message_ids=source_message_ids,
    )
