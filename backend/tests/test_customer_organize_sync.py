from unittest.mock import ANY, AsyncMock, patch

import pytest

from app.schemas.order import OrderDraftUpdate
from app.services.customer_organize_sync import apply_customer_phone_from_organize


@pytest.mark.asyncio
async def test_apply_customer_phone_skips_when_not_in_update():
    with patch(
        "app.services.customer_organize_sync.update_user_info",
        new_callable=AsyncMock,
    ) as mock_update:
        result = await apply_customer_phone_from_organize(
            AsyncMock(),
            customer_id=1,
            draft_update=OrderDraftUpdate(item="花束"),
        )
    assert result is None
    mock_update.assert_not_called()


@pytest.mark.asyncio
async def test_apply_customer_phone_persists_when_present():
    with patch(
        "app.services.customer_organize_sync.update_user_info",
        new_callable=AsyncMock,
    ) as mock_update:
        result = await apply_customer_phone_from_organize(
            AsyncMock(),
            customer_id=42,
            draft_update=OrderDraftUpdate(customer_phone="0912345678"),
        )
    assert result == "0912345678"
    mock_update.assert_awaited_once_with(
        ANY,
        42,
        phone="0912345678",
        update_phone=True,
    )
