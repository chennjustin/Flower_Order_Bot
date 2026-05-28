import pytest

from app.schemas.order import OrderDraftUpdate
from app.services import order_service


class DummyRoom:
    def __init__(self, room_id: int):
        self.id = room_id


class DummyOrderDraft:
    def __init__(self):
        self.customer_id = 1
        self.item_type = None
        self.quantity = None
        self.total_amount = None
        self.notes = None
        self.shipment_method = None
        self.delivery_datetime = None
        self.delivery_address = None
        self.pay_way = None
        self.updated_at = None


class DummyDb:
    def add(self, _obj):
        return None

    async def commit(self):
        return None

    async def refresh(self, _obj):
        return None


@pytest.mark.asyncio
async def test_update_order_draft_skip_customer_update_when_disallowed(monkeypatch):
    called = {"update_user_info": False}

    async def fake_get_chat_room_by_room_id(_db, room_id):
        return DummyRoom(room_id)

    async def fake_get_order_draft_by_room(_db, _room_id):
        return DummyOrderDraft()

    async def fake_update_user_info(_db, _user_id, name=None, phone=None):
        called["update_user_info"] = True
        return None

    async def fake_get_order_draft_out_by_room(_db, _room_id):
        return {"ok": True}

    async def fake_get_user_by_id(_db, _user_id):
        raise AssertionError("allow_customer_update=False 時不應查詢 customer")

    monkeypatch.setattr(order_service, "get_chat_room_by_room_id", fake_get_chat_room_by_room_id)
    monkeypatch.setattr(order_service, "get_order_draft_by_room", fake_get_order_draft_by_room)
    monkeypatch.setattr(order_service, "update_user_info", fake_update_user_info)
    monkeypatch.setattr(order_service, "get_order_draft_out_by_room", fake_get_order_draft_out_by_room)
    monkeypatch.setattr(order_service, "get_user_by_id", fake_get_user_by_id)

    result = await order_service.update_order_draft_by_room_id(
        db=DummyDb(),
        room_id=1,
        draft_in=OrderDraftUpdate(customer_name="新名字", customer_phone="0999888777"),
        allow_customer_update=False,
    )

    assert result == {"ok": True}
    assert called["update_user_info"] is False
