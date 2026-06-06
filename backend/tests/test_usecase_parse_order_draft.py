from datetime import datetime

from app.schemas.order import OrderDraftOut, OrderDraftUpdate
from app.usecases.organize_order_draft import (
    _collect_missing_fields,
    _filter_update_by_visible_fields,
)
from app.usecases.llm_order_delta import merge_delta_into_catalog, parse_delta_json


def test_parse_delta_json_ignores_customer_name_but_updates_phone():
    delta = parse_delta_json('{"customer_name": "A", "customer_phone": "0999888777", "item": "rose"}')
    merged = merge_delta_into_catalog(
        {
            "customer_name": "王小明",
            "customer_phone": "0911222333",
            "item": "old",
            "total_amount": 800,
            "quantity": None,
            "note": None,
            "shipment_method": None,
            "send_datetime": None,
            "delivery_address": None,
            "pay_way": None,
            "pay_status": None,
        },
        delta,
        flow="draft",
    )
    assert merged["customer_name"] == "王小明"
    assert merged["customer_phone"] == "0999888777"
    assert merged["item"] == "rose"


def test_parse_delta_json_allows_phone_when_empty_baseline():
    delta = parse_delta_json('{"customer_phone": "0912345678"}')
    merged = merge_delta_into_catalog(
        {
            "customer_name": "王小明",
            "customer_phone": "",
            "item": "rose",
            "total_amount": 800,
            "quantity": None,
            "note": None,
            "shipment_method": None,
            "send_datetime": None,
            "delivery_address": None,
            "pay_way": None,
            "pay_status": None,
        },
        delta,
        flow="draft",
    )
    assert merged["customer_phone"] == "0912345678"


def test_collect_missing_fields_respects_optional_required_settings():
    draft = OrderDraftOut(
        id=1,
        customer_name="王小明",
        customer_phone="0911222333",
        item="花束",
        total_amount=1000,
        order_date=datetime(2026, 5, 1, 10, 0, 0),
        send_datetime=datetime(2026, 5, 2, 10, 0, 0),
        quantity=None,
    )
    update = OrderDraftUpdate()
    missing = _collect_missing_fields(
        draft,
        update,
        required_fields={"customer_name", "customer_phone", "item", "send_datetime", "total_amount"},
    )
    assert missing == []

    missing_with_optional = _collect_missing_fields(
        draft,
        update,
        required_fields={
            "customer_name",
            "customer_phone",
            "item",
            "send_datetime",
            "total_amount",
            "quantity",
        },
    )
    assert "數量" in missing_with_optional


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
