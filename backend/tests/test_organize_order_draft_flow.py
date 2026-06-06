"""End-to-end organize flow checks: visible fields, delta merge, phone sync."""

from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.enums.chat import ChatMessageDirection
from app.schemas.order import OrderDraftOut, OrderDraftUpdate
from app.services.order_field_config_service import EffectiveOrderFieldConfig
from app.usecases.organize_order_draft import organize_order_draft


def _message(text: str, msg_id: int = 1):
    return type(
        "Msg",
        (),
        {
            "id": msg_id,
            "text": text,
            "direction": ChatMessageDirection.OUTGOING_BY_STORE,
            "created_at": datetime(2026, 6, 6, 14, 0, 0),
        },
    )()


@pytest.mark.asyncio
async def test_organize_persists_visible_note_and_syncs_phone():
    """LLM delta for visible optional fields must persist; phone syncs to Customer."""
    draft_before = OrderDraftOut(
        id=1,
        customer_name="王小明",
        customer_phone="",
        item="花束",
        total_amount=1000,
        note=None,
        order_date=datetime(2026, 6, 6, 10, 0, 0),
    )
    draft_after = OrderDraftOut(
        id=1,
        customer_name="王小明",
        customer_phone="0912345678",
        item="花束",
        total_amount=1000,
        note="黃色點綴",
        order_date=datetime(2026, 6, 6, 10, 0, 0),
    )

    field_config = EffectiveOrderFieldConfig(
        store_id=1,
        visible_fields=[
            "customer_name",
            "customer_phone",
            "item",
            "total_amount",
            "send_datetime",
            "note",
        ],
        field_order=[],
        organize_required_fields=[
            "customer_name",
            "customer_phone",
            "item",
            "send_datetime",
            "total_amount",
        ],
    )

    room = type("Room", (), {"id": 10, "store_id": 1, "customer_id": 99})()
    messages = [
        _message("備註改成黃色點綴", 101),
        _message("我的電話 0912-345-678", 102),
    ]

    mock_db = AsyncMock()
    room_result = MagicMock()
    room_result.scalars.return_value.first.return_value = room
    messages_result = MagicMock()
    messages_result.scalars.return_value.all.return_value = messages
    mock_db.execute = AsyncMock(side_effect=[room_result, messages_result, MagicMock()])
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()

    captured_patch: dict[str, OrderDraftUpdate] = {}

    async def _capture_update(db, room_id, draft_in, allow_customer_update=False):
        captured_patch["payload"] = draft_in
        return draft_after

    with (
        patch(
            "app.usecases.organize_order_draft.get_effective_order_field_config",
            new_callable=AsyncMock,
            return_value=field_config,
        ),
        patch(
            "app.usecases.organize_order_draft.get_order_draft_out_by_room",
            new_callable=AsyncMock,
            return_value=draft_before,
        ),
        patch(
            "app.usecases.organize_order_draft.complete_system_prompt",
            return_value='{"note": "黃色點綴", "customer_phone": "0912345678"}',
        ),
        patch(
            "app.usecases.organize_order_draft.apply_customer_phone_from_organize",
            new_callable=AsyncMock,
            return_value="0912345678",
        ) as mock_phone_sync,
        patch(
            "app.usecases.organize_order_draft.update_order_draft_by_room_id",
            side_effect=_capture_update,
        ),
        patch("app.usecases.organize_order_draft.get_line_uid_by_chatroom_id", new_callable=AsyncMock, return_value=None),
    ):
        result = await organize_order_draft(mock_db, chat_room_id=10)

    mock_phone_sync.assert_awaited_once()
    patch_payload = captured_patch["payload"]
    assert patch_payload.note == "黃色點綴"
    assert "customer_phone" not in patch_payload.model_fields_set
    assert "customer_name" not in patch_payload.model_fields_set
    assert result.changed_fields == ["customer_phone", "note"]
    assert result.draft.note == "黃色點綴"
    assert result.draft.customer_phone == "0912345678"
    assert result.source_message_ids == [101, 102]


@pytest.mark.asyncio
async def test_organize_missing_field_notice_ignores_phone_filled_in_same_run():
    """LINE reminder must not ask for phone when LLM extracted it this organize."""
    draft_before = OrderDraftOut(
        id=1,
        customer_name="王小明",
        customer_phone="",
        item="花束",
        total_amount=1000,
        note=None,
        order_date=datetime(2026, 6, 6, 10, 0, 0),
    )
    draft_after = OrderDraftOut(
        id=1,
        customer_name="王小明",
        customer_phone="0912345678",
        item="花束",
        total_amount=1000,
        note=None,
        order_date=datetime(2026, 6, 6, 10, 0, 0),
    )

    field_config = EffectiveOrderFieldConfig(
        store_id=1,
        visible_fields=[
            "customer_name",
            "customer_phone",
            "item",
            "total_amount",
            "send_datetime",
        ],
        field_order=[],
        organize_required_fields=[
            "customer_name",
            "customer_phone",
            "item",
            "send_datetime",
            "total_amount",
        ],
    )

    room = type("Room", (), {"id": 10, "store_id": 1, "customer_id": 99})()
    messages = [_message("我的電話 0912-345-678", 201)]

    mock_db = AsyncMock()
    room_result = MagicMock()
    room_result.scalars.return_value.first.return_value = room
    messages_result = MagicMock()
    messages_result.scalars.return_value.all.return_value = messages
    mock_db.execute = AsyncMock(side_effect=[room_result, messages_result, MagicMock()])
    mock_db.add = MagicMock()
    mock_db.commit = AsyncMock()

    pushed: list[str] = []

    def _capture_push(_api, _uid, payload):
        pushed.append(payload.text or "")
        return True

    with (
        patch(
            "app.usecases.organize_order_draft.get_effective_order_field_config",
            new_callable=AsyncMock,
            return_value=field_config,
        ),
        patch(
            "app.usecases.organize_order_draft.get_order_draft_out_by_room",
            new_callable=AsyncMock,
            return_value=draft_before,
        ),
        patch(
            "app.usecases.organize_order_draft.complete_system_prompt",
            return_value='{"customer_phone": "0912345678"}',
        ),
        patch(
            "app.usecases.organize_order_draft.apply_customer_phone_from_organize",
            new_callable=AsyncMock,
            return_value="0912345678",
        ),
        patch(
            "app.usecases.organize_order_draft.update_order_draft_by_room_id",
            new_callable=AsyncMock,
            return_value=draft_after,
        ),
        patch(
            "app.usecases.organize_order_draft.get_line_uid_by_chatroom_id",
            new_callable=AsyncMock,
            return_value="U123",
        ),
        patch(
            "app.usecases.organize_order_draft.get_store_by_id",
            new_callable=AsyncMock,
            return_value=type("Store", (), {"id": 1})(),
        ),
        patch(
            "app.usecases.organize_order_draft.line_bot_api_for_store",
            return_value=MagicMock(),
        ),
        patch(
            "app.usecases.organize_order_draft.LINE_push_message",
            side_effect=_capture_push,
        ),
    ):
        await organize_order_draft(mock_db, chat_room_id=10)

    assert len(pushed) == 1
    assert "顧客電話" not in pushed[0]
    assert "取貨時間" in pushed[0]
