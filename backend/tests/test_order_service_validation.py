import pytest

from app.domain.order_fields import CORE_ORGANIZE_FIELDS
from app.services import order_service
from app.services.order_field_config_service import EffectiveOrderFieldConfig


class DummyOrderDraft:
    def __init__(
        self,
        *,
        room_id=1,
        customer_id=1,
        item_type="rose",
        total_amount=1200,
        delivery_datetime="2026-05-26T12:00:00",
    ):
        self.room_id = room_id
        self.customer_id = customer_id
        self.item_type = item_type
        self.total_amount = total_amount
        self.delivery_datetime = delivery_datetime
        self.quantity = None
        self.notes = None
        self.shipment_method = None
        self.delivery_address = None
        self.pay_way = None
        self.pay_status = None


class DummyCustomer:
    def __init__(self, name="A", phone="0912000000"):
        self.name = name
        self.phone = phone


class DummyRoom:
    store_id = 1


@pytest.fixture
def patch_field_config(monkeypatch):
    async def fake_get_chat_room_by_room_id(_db, _room_id):
        return DummyRoom()

    async def fake_get_effective_order_field_config(_db, _store_id):
        return EffectiveOrderFieldConfig(
            store_id=1,
            visible_fields=[],
            organize_required_fields=list(CORE_ORGANIZE_FIELDS),
        )

    monkeypatch.setattr(
        order_service, "get_chat_room_by_room_id", fake_get_chat_room_by_room_id
    )
    monkeypatch.setattr(
        order_service,
        "get_effective_order_field_config",
        fake_get_effective_order_field_config,
    )


@pytest.mark.asyncio
async def test_validate_order_draft_required_fields_allows_core_fields(
    monkeypatch, patch_field_config
):
    async def fake_get_user_by_id(_db, _customer_id):
        return DummyCustomer()

    monkeypatch.setattr(order_service, "get_user_by_id", fake_get_user_by_id)

    order_draft = DummyOrderDraft()
    is_complete, missing_fields = await order_service.validate_order_draft_required_fields(
        db=None,
        order_draft=order_draft,
    )

    assert is_complete is True
    assert missing_fields == []


@pytest.mark.asyncio
async def test_validate_order_draft_required_fields_reports_catalog_keys(
    monkeypatch, patch_field_config
):
    async def fake_get_user_by_id(_db, _customer_id):
        return DummyCustomer(name="", phone="")

    monkeypatch.setattr(order_service, "get_user_by_id", fake_get_user_by_id)

    order_draft = DummyOrderDraft(
        item_type=None,
        total_amount=None,
        delivery_datetime=None,
    )
    is_complete, missing_fields = await order_service.validate_order_draft_required_fields(
        db=None,
        order_draft=order_draft,
    )

    assert is_complete is False
    assert "item" in missing_fields
    assert "total_amount" in missing_fields
    assert "send_datetime" in missing_fields
    assert "customer_name" in missing_fields
    assert "customer_phone" in missing_fields


@pytest.mark.asyncio
async def test_validate_reports_optional_field_when_visible_and_required(
    monkeypatch,
):
    async def fake_get_chat_room_by_room_id(_db, _room_id):
        return DummyRoom()

    async def fake_get_effective_order_field_config(_db, _store_id):
        return EffectiveOrderFieldConfig(
            store_id=1,
            visible_fields=[],
            organize_required_fields=[
                *CORE_ORGANIZE_FIELDS,
                "quantity",
            ],
        )

    async def fake_get_user_by_id(_db, _customer_id):
        return DummyCustomer()

    monkeypatch.setattr(
        order_service, "get_chat_room_by_room_id", fake_get_chat_room_by_room_id
    )
    monkeypatch.setattr(
        order_service,
        "get_effective_order_field_config",
        fake_get_effective_order_field_config,
    )
    monkeypatch.setattr(order_service, "get_user_by_id", fake_get_user_by_id)

    order_draft = DummyOrderDraft()
    order_draft.quantity = None
    is_complete, missing_fields = await order_service.validate_order_draft_required_fields(
        db=None,
        order_draft=order_draft,
    )

    assert is_complete is False
    assert missing_fields == ["quantity"]
