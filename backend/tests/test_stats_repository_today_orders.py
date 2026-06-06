"""Today order stats exclude cancelled orders from the denominator."""

from __future__ import annotations

from datetime import datetime

import pytest

from app.repositories.stats_repository import count_today_orders


@pytest.mark.asyncio
async def test_count_today_orders_excludes_cancelled() -> None:
    captured: list[object] = []

    class FakeResult:
        def scalar(self):
            return 0

    class FakeSession:
        async def execute(self, stmt):
            captured.append(stmt)
            return FakeResult()

    today_start = datetime(2026, 6, 6, 0, 0, 0)
    today_end = datetime(2026, 6, 7, 0, 0, 0)

    await count_today_orders(FakeSession(), store_id=1, today_start=today_start, today_end=today_end)

    assert len(captured) == 1
    stmt_str = str(captured[0])
    assert '"order".status !=' in stmt_str
