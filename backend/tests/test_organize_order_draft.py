from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.schemas.order import OrderDraftOut
from app.usecases.organize_order_draft import organize_order_draft


@pytest.mark.asyncio
async def test_organize_skips_openai_when_no_messages():
    draft = OrderDraftOut(
        id=1,
        customer_name="王小明",
        customer_phone="",
        item="花束",
        total_amount=1000,
        order_date=datetime(2026, 6, 6, 10, 0, 0),
    )
    mock_db = AsyncMock()

    with (
        patch(
            "app.usecases.organize_order_draft.get_effective_order_field_config",
            new_callable=AsyncMock,
        ) as mock_config,
        patch(
            "app.usecases.organize_order_draft.get_order_draft_out_by_room",
            new_callable=AsyncMock,
            return_value=draft,
        ),
        patch("app.usecases.organize_order_draft.complete_system_prompt") as mock_llm,
    ):
        mock_config.return_value.organize_required_fields = ["item", "total_amount"]
        room = type("Room", (), {"id": 10, "store_id": 1})()

        room_result = MagicMock()
        room_result.scalars.return_value.first.return_value = room
        messages_result = MagicMock()
        messages_result.scalars.return_value.all.return_value = []
        mock_db.execute = AsyncMock(side_effect=[room_result, messages_result])

        result = await organize_order_draft(mock_db, chat_room_id=10)

    mock_llm.assert_not_called()
    assert result.draft == draft
    assert result.changed_fields == []
    assert result.source_message_ids == []
