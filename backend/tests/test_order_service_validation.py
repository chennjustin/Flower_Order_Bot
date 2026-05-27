import pytest

from app.services import order_service


class DummyOrderDraft:
    def __init__(
        self,
        *,
        customer_id=1,
        item_type="rose",
        total_amount=1200,
        delivery_datetime="2026-05-26T12:00:00",
    ):
        self.customer_id = customer_id
        self.item_type = item_type
        self.total_amount = total_amount
        self.delivery_datetime = delivery_datetime


class DummyCustomer:
    def __init__(self, name="A", phone="0912000000"):
        self.name = name
        self.phone = phone


@pytest.mark.asyncio
async def test_validate_order_draft_required_fields_allows_nullable_optional_fields(monkeypatch):
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
async def test_validate_order_draft_required_fields_reports_core_missing(monkeypatch):
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
    assert "item_type" in missing_fields
    assert "total_amount" in missing_fields
    assert "delivery_datetime" in missing_fields
    assert "customer_name" in missing_fields
    assert "customer_phone" in missing_fields
