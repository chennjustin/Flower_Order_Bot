import pytest
from fastapi import HTTPException

from app.enums.order import OrderStatus
from app.services import order_service


class DummyOrder:
    def __init__(self, order_id: int = 1, status: OrderStatus = OrderStatus.CONFIRMED):
        self.id = order_id
        self.status = status
        self.updated_at = None


class DummyOrderOut:
    def __init__(self, order_id: int, status: OrderStatus):
        self.id = order_id
        self.order_status = status


@pytest.mark.asyncio
async def test_update_order_status_by_id_sets_status_and_returns_out(monkeypatch):
    order = DummyOrder()

    async def fake_get_order_by_id(_db, _order_id):
        return order

    async def fake_build_order_out(_db, updated_order):
        return DummyOrderOut(updated_order.id, updated_order.status)

    monkeypatch.setattr(order_service, "get_order_by_id", fake_get_order_by_id)
    monkeypatch.setattr(order_service, "_build_order_out", fake_build_order_out)
    monkeypatch.setattr(order_service, "now_taipei_naive", lambda: "2026-05-30T00:00:00")

    class FakeSession:
        async def commit(self):
            pass

        async def refresh(self, _obj):
            pass

        def add(self, _obj):
            pass

    result = await order_service.update_order_status_by_id(
        FakeSession(),
        order_id=1,
        new_status=OrderStatus.COMPLETED,
    )

    assert order.status == OrderStatus.COMPLETED
    assert order.updated_at == "2026-05-30T00:00:00"
    assert result.order_status == OrderStatus.COMPLETED


@pytest.mark.asyncio
async def test_update_order_status_by_id_not_found(monkeypatch):
    async def fake_get_order_by_id(_db, _order_id):
        return None

    monkeypatch.setattr(order_service, "get_order_by_id", fake_get_order_by_id)

    with pytest.raises(HTTPException) as exc:
        await order_service.update_order_status_by_id(
            None,
            order_id=999,
            new_status=OrderStatus.CANCELLED,
        )

    assert exc.value.status_code == 404
