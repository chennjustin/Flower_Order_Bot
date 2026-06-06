import pytest

from app.enums.order import OrderStatus
from app.enums.payment import PaymentStatus
from app.enums.shipment import ShipmentMethod
from app.schemas.order import OrderPatchUpdate, OrderOut
from app.services import order_service


class DummyOrder:
    def __init__(self):
        self.id = 155
        self.room_id = 134
        self.customer_name = "Alice"
        self.customer_phone = "0912000000"
        self.item_type = "rose bouquet"
        self.quantity = 2
        self.total_amount = 1200.0
        self.notes = "old note"
        self.shipment_method = ShipmentMethod.DELIVERY
        self.delivery_datetime = None
        self.delivery_address = "old address"
        self.pay_way = "cash"
        self.pay_status = PaymentStatus.PENDING
        self.status = OrderStatus.CONFIRMED
        self.updated_at = None


class DummyDb:
    def add(self, _obj):
        return None

    async def commit(self):
        return None

    async def refresh(self, _obj):
        return None

    async def execute(self, _stmt):
        return None


def _fake_order_out(order: DummyOrder) -> OrderOut:
    return OrderOut(
        id=order.id,
        customer_name=order.customer_name or "",
        customer_phone=order.customer_phone or "",
        order_date="2026-06-06T09:00:00+08:00",
        order_status=order.status,
        pay_way=order.pay_way,
        pay_status=order.pay_status or PaymentStatus.PENDING,
        total_amount=float(order.total_amount),
        item=order.item_type,
        quantity=order.quantity if order.quantity is not None else 0,
        note=order.notes,
        shipment_method=order.shipment_method or ShipmentMethod.STORE_PICKUP,
        send_datetime=None,
        delivery_address=order.delivery_address or "",
    )


@pytest.mark.asyncio
async def test_update_order_fields_clears_nullable_columns(monkeypatch):
    order = DummyOrder()

    async def fake_get_order_by_id(_db, _order_id):
        return order

    async def fake_build_order_out(_db, current):
        return _fake_order_out(current)

    async def fake_mark_messages(_db, _room_id, _ids):
        return None

    monkeypatch.setattr(order_service, "get_order_by_id", fake_get_order_by_id)
    monkeypatch.setattr(order_service, "_build_order_out", fake_build_order_out)
    monkeypatch.setattr(order_service, "_mark_chat_messages_processed", fake_mark_messages)

    await order_service.update_order_fields_by_id(
        db=DummyDb(),
        order_id=order.id,
        patch=OrderPatchUpdate(note=None, delivery_address=None, quantity=None),
    )

    assert order.notes is None
    assert order.delivery_address is None
    assert order.quantity is None
    assert order.item_type == "rose bouquet"
    assert order.total_amount == 1200.0


@pytest.mark.asyncio
async def test_update_order_fields_ignores_null_for_not_null_columns(monkeypatch):
    order = DummyOrder()

    async def fake_get_order_by_id(_db, _order_id):
        return order

    async def fake_build_order_out(_db, current):
        return _fake_order_out(current)

    async def fake_mark_messages(_db, _room_id, _ids):
        return None

    monkeypatch.setattr(order_service, "get_order_by_id", fake_get_order_by_id)
    monkeypatch.setattr(order_service, "_build_order_out", fake_build_order_out)
    monkeypatch.setattr(order_service, "_mark_chat_messages_processed", fake_mark_messages)

    await order_service.update_order_fields_by_id(
        db=DummyDb(),
        order_id=order.id,
        patch=OrderPatchUpdate(item=None, total_amount=None),
    )

    assert order.item_type == "rose bouquet"
    assert order.total_amount == 1200.0


@pytest.mark.asyncio
async def test_update_order_fields_updates_not_null_columns_with_values(monkeypatch):
    order = DummyOrder()

    async def fake_get_order_by_id(_db, _order_id):
        return order

    async def fake_build_order_out(_db, current):
        return _fake_order_out(current)

    async def fake_mark_messages(_db, _room_id, _ids):
        return None

    monkeypatch.setattr(order_service, "get_order_by_id", fake_get_order_by_id)
    monkeypatch.setattr(order_service, "_build_order_out", fake_build_order_out)
    monkeypatch.setattr(order_service, "_mark_chat_messages_processed", fake_mark_messages)

    await order_service.update_order_fields_by_id(
        db=DummyDb(),
        order_id=order.id,
        patch=OrderPatchUpdate(item="orchid", total_amount=2500),
    )

    assert order.item_type == "orchid"
    assert order.total_amount == 2500
