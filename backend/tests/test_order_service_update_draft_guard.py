import pytest

from app.schemas.order import OrderDraftUpdate
from app.services import order_service


class DummyRoom:
    def __init__(self, room_id: int):
        self.id = room_id


class DummyOrderDraft:
    def __init__(self):
        self.customer_id = 1
        self.item_type = "rose bouquet"
        self.quantity = 2
        self.total_amount = 1200
        self.notes = "old note"
        self.shipment_method = None
        self.delivery_datetime = None
        self.delivery_address = "old address"
        self.pay_way = "cash"
        self.pay_status = None
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


@pytest.mark.asyncio
async def test_update_order_draft_clears_fields_when_client_sends_null(monkeypatch):
    draft = DummyOrderDraft()

    async def fake_get_chat_room_by_room_id(_db, room_id):
        return DummyRoom(room_id)

    async def fake_get_order_draft_by_room(_db, _room_id):
        return draft

    async def fake_get_order_draft_out_by_room(_db, _room_id):
        return {"ok": True}

    monkeypatch.setattr(order_service, "get_chat_room_by_room_id", fake_get_chat_room_by_room_id)
    monkeypatch.setattr(order_service, "get_order_draft_by_room", fake_get_order_draft_by_room)
    monkeypatch.setattr(order_service, "get_order_draft_out_by_room", fake_get_order_draft_out_by_room)
    async def reject_customer_lookup(*_args, **_kwargs):
        raise AssertionError("customer update not expected")

    monkeypatch.setattr(order_service, "get_user_by_id", reject_customer_lookup)
    monkeypatch.setattr(order_service, "update_user_info", reject_customer_lookup)

    await order_service.update_order_draft_by_room_id(
        db=DummyDb(),
        room_id=1,
        draft_in=OrderDraftUpdate(item=None, note=None, delivery_address=None, quantity=None),
        allow_customer_update=False,
    )

    assert draft.item_type is None
    assert draft.notes is None
    assert draft.delivery_address is None
    assert draft.quantity is None


@pytest.mark.asyncio
async def test_update_order_draft_changes_customer_phone(monkeypatch):
    draft = DummyOrderDraft()
    customer = type("Customer", (), {"id": 1, "name": "Alice", "phone": "0912000000"})()
    updated: dict[str, str | None] = {}

    async def fake_get_chat_room_by_room_id(_db, room_id):
        return DummyRoom(room_id)

    async def fake_get_order_draft_by_room(_db, _room_id):
        return draft

    async def fake_get_user_by_id(_db, _customer_id):
        return customer

    async def fake_update_user_info(
        _db, user_id, *, name=None, phone=None, update_name=False, update_phone=False
    ):
        updated["user_id"] = user_id
        updated["name"] = name
        updated["phone"] = phone
        updated["update_name"] = update_name
        updated["update_phone"] = update_phone
        return customer

    async def fake_get_order_draft_out_by_room(_db, _room_id):
        return {"ok": True}

    monkeypatch.setattr(order_service, "get_chat_room_by_room_id", fake_get_chat_room_by_room_id)
    monkeypatch.setattr(order_service, "get_order_draft_by_room", fake_get_order_draft_by_room)
    monkeypatch.setattr(order_service, "get_user_by_id", fake_get_user_by_id)
    monkeypatch.setattr(order_service, "update_user_info", fake_update_user_info)
    monkeypatch.setattr(order_service, "get_order_draft_out_by_room", fake_get_order_draft_out_by_room)

    await order_service.update_order_draft_by_room_id(
        db=DummyDb(),
        room_id=1,
        draft_in=OrderDraftUpdate(customer_phone="0999888777"),
        allow_customer_update=True,
    )

    assert updated["user_id"] == 1
    assert updated["phone"] == "0999888777"
    assert updated["update_phone"] is True
    assert updated["update_name"] is False


@pytest.mark.asyncio
async def test_update_order_draft_clears_customer_phone(monkeypatch):
    draft = DummyOrderDraft()
    customer = type("Customer", (), {"id": 1, "name": "Alice", "phone": "0912000000"})()
    updated: dict[str, str | None] = {}

    async def fake_get_chat_room_by_room_id(_db, room_id):
        return DummyRoom(room_id)

    async def fake_get_order_draft_by_room(_db, _room_id):
        return draft

    async def fake_get_user_by_id(_db, _customer_id):
        return customer

    async def fake_update_user_info(
        _db, user_id, *, name=None, phone=None, update_name=False, update_phone=False
    ):
        updated["phone"] = phone
        updated["update_phone"] = update_phone
        return customer

    async def fake_get_order_draft_out_by_room(_db, _room_id):
        return {"ok": True}

    monkeypatch.setattr(order_service, "get_chat_room_by_room_id", fake_get_chat_room_by_room_id)
    monkeypatch.setattr(order_service, "get_order_draft_by_room", fake_get_order_draft_by_room)
    monkeypatch.setattr(order_service, "get_user_by_id", fake_get_user_by_id)
    monkeypatch.setattr(order_service, "update_user_info", fake_update_user_info)
    monkeypatch.setattr(order_service, "get_order_draft_out_by_room", fake_get_order_draft_out_by_room)

    await order_service.update_order_draft_by_room_id(
        db=DummyDb(),
        room_id=1,
        draft_in=OrderDraftUpdate(customer_phone=None),
        allow_customer_update=True,
    )

    assert updated["phone"] is None
    assert updated["update_phone"] is True
