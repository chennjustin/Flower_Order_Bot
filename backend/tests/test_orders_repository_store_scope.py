"""Orders list is scoped to chat_room.store_id (multi-tenant Step 4/9)."""

from __future__ import annotations

import pytest

from app.repositories.order_repository import list_active_orders


@pytest.mark.asyncio
async def test_list_active_orders_passes_store_id_to_query() -> None:
    captured: list[object] = []

    class FakeResult:
        def scalars(self):
            return self

        def all(self):
            return []

    class FakeSession:
        async def execute(self, stmt):
            captured.append(stmt)
            return FakeResult()

    await list_active_orders(FakeSession(), store_id=7)

    assert len(captured) == 1
    stmt_str = str(captured[0])
    assert "store_id" in stmt_str
    assert "chat_room" in stmt_str
