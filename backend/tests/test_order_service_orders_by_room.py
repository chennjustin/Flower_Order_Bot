import pytest
from fastapi import HTTPException

from app.enums.order import OrderStatus
from app.services import order_service


class DummyRoom:
    def __init__(self, room_id: int, customer_id: int):
        self.id = room_id
        self.customer_id = customer_id


class DummyOrder:
    def __init__(self, order_id: int):
        self.id = order_id
        self.customer_name = "Test User"
        self.customer_phone = "0912345678"
        self.created_at = None
        self.status = OrderStatus.CONFIRMED
        self.pay_way = None
        self.pay_status = None
        self.total_amount = 100.0
        self.item_type = "Rose bouquet"
        self.quantity = 1
        self.notes = None
        self.shipment_method = None
        self.delivery_datetime = None
        self.delivery_address = ""


@pytest.mark.asyncio
async def test_get_orders_by_room_id_returns_customer_orders(monkeypatch):
    async def fake_get_chat_room_by_room_id(_db, room_id):
        return DummyRoom(room_id, customer_id=7)

    async def fake_list_orders_by_customer_id(_db, customer_id):
        assert customer_id == 7
        return [DummyOrder(101), DummyOrder(99)]

    async def fake_build_order_out(_db, order):
        from app.schemas.order import OrderOut
        from app.enums.payment import PaymentStatus

        return OrderOut(
            id=order.id,
            customer_name=order.customer_name,
            customer_phone=order.customer_phone,
            order_date=order_service.now_taipei_naive(),
            order_status=order.status,
            pay_way=None,
            pay_status=PaymentStatus.PENDING,
            total_amount=float(order.total_amount),
            item=order.item_type,
            quantity=order.quantity,
            note=None,
            shipment_method=None,
            send_datetime=None,
            delivery_address="",
        )

    monkeypatch.setattr(order_service, "get_chat_room_by_room_id", fake_get_chat_room_by_room_id)
    monkeypatch.setattr(order_service, "list_orders_by_customer_id", fake_list_orders_by_customer_id)
    monkeypatch.setattr(order_service, "_build_order_out", fake_build_order_out)

    results = await order_service.get_orders_by_room_id(None, room_id=42)

    assert len(results) == 2
    assert results[0].id == 101
    assert results[1].id == 99


@pytest.mark.asyncio
async def test_get_orders_by_room_id_not_found(monkeypatch):
    async def fake_get_chat_room_by_room_id(_db, _room_id):
        return None

    monkeypatch.setattr(order_service, "get_chat_room_by_room_id", fake_get_chat_room_by_room_id)

    with pytest.raises(HTTPException) as exc:
        await order_service.get_orders_by_room_id(None, room_id=999)

    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_get_orders_by_room_id_empty_list(monkeypatch):
    async def fake_get_chat_room_by_room_id(_db, room_id):
        return DummyRoom(room_id, customer_id=3)

    async def fake_list_orders_by_customer_id(_db, _customer_id):
        return []

    monkeypatch.setattr(order_service, "get_chat_room_by_room_id", fake_get_chat_room_by_room_id)
    monkeypatch.setattr(order_service, "list_orders_by_customer_id", fake_list_orders_by_customer_id)

    results = await order_service.get_orders_by_room_id(None, room_id=1)
    assert results == []
