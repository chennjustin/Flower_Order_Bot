from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.adapters.llm.json_extract import JsonExtractError
from app.adapters.llm.openai_chat import (
    DEFAULT_LLM_MODEL,
    LlmServiceUnavailableError,
    complete_system_prompt,
)
from app.core.line_client import line_bot_api_for_store
from app.enums.chat import ChatMessageDirection, ChatMessageStatus
from app.models.chat import ChatMessage, ChatRoom
from app.repositories.store_repository import get_store_by_id
from app.schemas.chat import ChatMessagePayload
from app.schemas.order import OrderDraftOut, OrderDraftUpdate, OrganizeOrderDraftOut
from app.services.order_field_config_service import get_effective_order_field_config
from app.services.order_field_values import (
    collect_missing_catalog_labels,
    draft_out_catalog_values,
)
from app.services.customer_organize_sync import apply_customer_phone_from_organize
from app.services.order_service import (
    create_order_draft_by_room_id,
    get_order_draft_out_by_room,
    update_order_draft_by_room_id,
)
from app.services.user_service import get_line_uid_by_chatroom_id
from app.utils.line_send_message import LINE_push_message
from app.managers.prompt_manager import PromptManager
from app.usecases.llm_order_delta import (
    build_chat_text,
    build_draft_update_from_merged,
    compute_changed_fields,
    draft_out_to_catalog_values,
    draft_visible_baseline_for_llm,
    filter_changed_fields_to_visible,
    merge_delta_into_catalog,
    parse_delta_json,
    reference_now_taipei,
)


logger = logging.getLogger(__name__)
prompt_manager = PromptManager()

_ORGANIZE_LOG_WIDTH = 72


def _log_organize_block(title: str, body: str) -> None:
    """Print a readable block to the uvicorn terminal (always visible in dev)."""

    border = "=" * _ORGANIZE_LOG_WIDTH
    print(f"{border}\n[organize] {title}\n{body}\n{border}", flush=True)


def _log_organize_json(title: str, payload: object) -> None:
    text = json.dumps(payload, ensure_ascii=False, indent=2, default=str)
    _log_organize_block(title, text)

DRAFT_CUSTOMER_IDENTITY_RULES = """- `customer_name`: do not output; fixed from customer profile.
- `customer_phone`: MUST output when new messages mention a phone number (fill empty baseline or replace with a new/corrected number). Use key `customer_phone` only.
  Triggers: customer says "我的電話…", "聯絡我…", or sends digits like 0912345678 / +886912345678.
  Phone is stored on the customer profile (not the draft row); backend will sync it when this field is present."""


def _filter_update_by_visible_fields(
    order_draft_update: OrderDraftUpdate, visible_fields: set[str]
) -> OrderDraftUpdate:
    """Keep LLM delta only for optional catalog fields the store has enabled.

    organize_required_fields controls missing-field validation only; visibility
    controls which optional fields the LLM may write during organize.
    """

    optional_fields = (
        "quantity",
        "note",
        "shipment_method",
        "delivery_address",
        "pay_way",
        "pay_status",
    )
    payload = order_draft_update.model_dump(exclude_unset=True)
    for field_name in optional_fields:
        if field_name in payload and field_name not in visible_fields:
            payload.pop(field_name)
    return OrderDraftUpdate(**payload)


def _collect_missing_fields(
    draft: OrderDraftOut,
    order_draft_update: OrderDraftUpdate,
    required_fields: set[str],
) -> list[str]:
    effective_values = draft_out_catalog_values(draft, order_draft_update)
    return collect_missing_catalog_labels(effective_values, required_fields)


def _load_draft_organize_prompt(
    *,
    baseline: OrderDraftOut,
    visible_fields: set[str],
    combined_text: str,
    message_count: int,
) -> str:
    extraction_rules = prompt_manager.load_prompt(
        "order_extraction_rules",
        reference_now=reference_now_taipei(),
        customer_identity_rules=DRAFT_CUSTOMER_IDENTITY_RULES,
    )
    return prompt_manager.load_prompt(
        "order_prompt",
        extraction_rules=extraction_rules,
        baseline=draft_visible_baseline_for_llm(baseline, visible_fields),
        user_message=combined_text,
        message_count=message_count,
    )


async def organize_order_draft(db: AsyncSession, chat_room_id: int) -> OrganizeOrderDraftOut:
    result = await db.execute(select(ChatRoom).where(ChatRoom.id == chat_room_id))
    chat_room = result.scalars().first()
    if not chat_room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="找不到聊天室")
    field_config = await get_effective_order_field_config(db, chat_room.store_id)

    draft = await get_order_draft_out_by_room(db, chat_room.id)
    if not draft:
        await create_order_draft_by_room_id(db, room_id=chat_room.id)
        draft = await get_order_draft_out_by_room(db, chat_room.id)
    if not draft:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load order draft.",
        )

    stmt = (
        select(ChatMessage)
        .where(ChatMessage.room_id == chat_room_id, ChatMessage.processed == False)
        .order_by(ChatMessage.created_at.asc())
    )
    messages_result = await db.execute(stmt)
    messages = list(messages_result.scalars().all())
    source_message_ids = [m.id for m in messages]

    _log_organize_block(
        "START",
        f"room_id={chat_room_id} message_count={len(messages)} "
        f"source_message_ids={source_message_ids}",
    )
    _log_organize_json("INPUT baseline", draft.model_dump(mode="json"))

    if not messages:
        _log_organize_block("SKIP", "No unprocessed messages — LLM not called.")
        return OrganizeOrderDraftOut(
            draft=draft,
            changed_fields=[],
            source_message_ids=[],
        )

    combined_text = build_chat_text(messages)
    _log_organize_block("INPUT new_messages", combined_text)

    visible_fields = set(field_config.visible_fields)
    gpt_prompt = _load_draft_organize_prompt(
        baseline=draft,
        visible_fields=visible_fields,
        combined_text=combined_text,
        message_count=len(messages),
    )
    _log_organize_block(
        "INPUT llm_prompt",
        f"model={DEFAULT_LLM_MODEL}\n\n{gpt_prompt}",
    )

    try:
        gpt_reply = complete_system_prompt(gpt_prompt, model=DEFAULT_LLM_MODEL, temperature=0)
        _log_organize_block("OUTPUT llm_raw", gpt_reply or "(empty)")
        delta = parse_delta_json(gpt_reply)
        _log_organize_json("OUTPUT parsed_delta", delta)
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

    baseline_values = draft_out_to_catalog_values(draft)
    merged_values = merge_delta_into_catalog(baseline_values, delta, flow="draft")
    order_draft_update = build_draft_update_from_merged(draft, merged_values)

    required_fields = set(field_config.organize_required_fields)
    order_draft_update = _filter_update_by_visible_fields(order_draft_update, visible_fields)
    effective_values = draft_out_catalog_values(draft, order_draft_update)
    changed_fields = filter_changed_fields_to_visible(
        compute_changed_fields(baseline_values, effective_values),
        visible_fields,
    )
    missing_fields = _collect_missing_fields(draft, order_draft_update, required_fields)

    _log_organize_json("OUTPUT merged_catalog", merged_values)
    _log_organize_block("OUTPUT changed_fields", str(changed_fields))
    _log_organize_json(
        "OUTPUT draft_update (after visible-field filter)",
        order_draft_update.model_dump(mode="json", exclude_unset=True),
    )
    if missing_fields:
        _log_organize_block("OUTPUT missing_fields", str(missing_fields))

    if missing_fields:
        warning_msg = (
            "智慧客服已根據對話內容整理好訂單草稿囉！"
            "我們發現了一些缺少的資料，請幫我們直接在下方補上～\n"
            + "\n".join(f"- {f}" for f in missing_fields)
        )
        logger.info("Draft organize missing fields for room %s: %s", chat_room_id, missing_fields)

        line_uid = await get_line_uid_by_chatroom_id(db, chat_room.id)
        if line_uid:
            store = await get_store_by_id(db, chat_room.store_id)
            if store:
                line_api = line_bot_api_for_store(store)
                LINE_push_message(line_api, line_uid, ChatMessagePayload(text=warning_msg))
        else:
            logger.warning("Cannot push missing-field reminder; LINE UID not found for room %s", chat_room.id)

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

    # Customer phone lives on Customer table — sync before draft row update.
    draft_update_for_order = order_draft_update
    if "customer_phone" in order_draft_update.model_fields_set:
        synced_phone = await apply_customer_phone_from_organize(
            db,
            customer_id=chat_room.customer_id,
            draft_update=order_draft_update,
        )
        _log_organize_block(
            "OUTPUT customer_phone_sync",
            f"customer_id={chat_room.customer_id} phone={synced_phone!r}",
        )
        # order_draft row has no phone column; avoid passing customer_phone into draft PATCH.
        draft_payload = order_draft_update.model_dump(exclude_unset=True)
        draft_payload.pop("customer_phone", None)
        draft_payload.pop("customer_name", None)
        draft_update_for_order = OrderDraftUpdate(**draft_payload)

    _log_organize_json(
        "OUTPUT order_draft_patch",
        draft_update_for_order.model_dump(mode="json", exclude_unset=True),
    )

    order_draft_out = await update_order_draft_by_room_id(
        db=db,
        room_id=chat_room.id,
        draft_in=draft_update_for_order,
        allow_customer_update=False,
    )

    if messages:
        stmt = (
            update(ChatMessage)
            .where(ChatMessage.id.in_(source_message_ids))
            .values(processed=True)
        )
        await db.execute(stmt)
        await db.commit()

    result = OrganizeOrderDraftOut(
        draft=order_draft_out,
        changed_fields=changed_fields,
        source_message_ids=source_message_ids,
    )
    _log_organize_json(
        "DONE api_response",
        {
            "changed_fields": result.changed_fields,
            "source_message_ids": result.source_message_ids,
            "draft": result.draft.model_dump(mode="json"),
        },
    )
    return result
