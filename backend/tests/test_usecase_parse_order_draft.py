from datetime import datetime

from app.schemas.order import OrderDraftUpdate
from app.usecases.organize_order_draft import _filter_update_by_visible_fields


def test_filter_update_preserves_untouched_fields_on_partial_delta():
    """Delta-only LLM output must not clear optional fields that were not sent."""
    update = OrderDraftUpdate(total_amount=2500, note="粉白色系")
    filtered = _filter_update_by_visible_fields(
        update,
        visible_fields={"item", "total_amount", "send_datetime", "note"},
    )
    assert filtered.total_amount == 2500
    assert filtered.note == "粉白色系"
    assert "quantity" not in filtered.model_fields_set
    assert "shipment_method" not in filtered.model_fields_set
    assert "delivery_address" not in filtered.model_fields_set


def test_filter_update_keeps_visible_optional_fields_without_organize_required():
    """Optional fields enabled in the UI must persist even when not organize-required."""
    update = OrderDraftUpdate(note="黃色點綴")
    filtered = _filter_update_by_visible_fields(
        update,
        visible_fields={"item", "total_amount", "send_datetime", "note"},
    )
    assert filtered.note == "黃色點綴"


def test_filter_update_drops_fields_not_visible_to_store():
    update = OrderDraftUpdate(
        customer_name="王小明",
        customer_phone="0911222333",
        item="花束",
        send_datetime=datetime(2026, 5, 2, 10, 0, 0),
        total_amount=1000,
        quantity=2,
        note="不要卡片",
        delivery_address="台北市信義區",
        pay_status=None,
    )
    filtered = _filter_update_by_visible_fields(
        update,
        visible_fields={
            "customer_name",
            "customer_phone",
            "item",
            "send_datetime",
            "total_amount",
        },
    )
    assert "quantity" not in filtered.model_fields_set
    assert "note" not in filtered.model_fields_set
    assert "delivery_address" not in filtered.model_fields_set
    assert "pay_status" not in filtered.model_fields_set
