from datetime import datetime

import pytest

from app.enums.payment import PaymentStatus
from app.enums.shipment import ShipmentMethod
from app.schemas.order import OrderDraftOut
from app.usecases.llm_order_delta import (
    build_draft_update_from_merged,
    build_visible_baseline_dict,
    compute_changed_fields,
    draft_visible_baseline_for_llm,
    filter_changed_fields_to_visible,
    is_phone_empty,
    merge_delta_into_catalog,
    normalize_phone,
    normalize_taipei_datetime,
    parse_delta_json,
)


def test_parse_delta_json_partial():
    delta = parse_delta_json('{"total_amount": 2500, "note": "粉白色系"}')
    assert delta["total_amount"] == 2500
    assert delta["note"] == "粉白色系"
    assert "item" not in delta


def test_phone_fill_only_when_baseline_empty():
    baseline = {
        "customer_name": "王小明",
        "customer_phone": "",
        "item": "花束",
        "total_amount": 1000,
        "quantity": None,
        "note": None,
        "shipment_method": None,
        "send_datetime": None,
        "delivery_address": None,
        "pay_way": None,
        "pay_status": None,
    }
    merged = merge_delta_into_catalog(
        baseline,
        {"customer_phone": "0912-345-678", "customer_name": "假名"},
        flow="draft",
    )
    assert merged["customer_phone"] == "0912345678"
    assert merged["customer_name"] == "王小明"


def test_phone_updates_when_customer_provides_different_number():
    baseline = {
        "customer_name": "王小明",
        "customer_phone": "0911222333",
        "item": "花束",
        "total_amount": 1000,
        "quantity": None,
        "note": None,
        "shipment_method": None,
        "send_datetime": None,
        "delivery_address": None,
        "pay_way": None,
        "pay_status": None,
    }
    merged = merge_delta_into_catalog(
        baseline,
        {"customer_phone": "0999888777"},
        flow="draft",
    )
    assert merged["customer_phone"] == "0999888777"


def test_phone_updates_in_order_suggest_flow():
    baseline = {
        "customer_name": "王小明",
        "customer_phone": "0911222333",
        "item": "花束",
        "total_amount": 1000,
        "quantity": 1,
        "note": None,
        "shipment_method": None,
        "send_datetime": None,
        "delivery_address": None,
        "pay_way": None,
        "pay_status": None,
    }
    merged = merge_delta_into_catalog(
        baseline,
        {"customer_phone": "0999888777"},
        flow="order_suggest",
    )
    assert merged["customer_phone"] == "0999888777"


def test_compute_changed_fields():
    baseline = {"total_amount": 2000, "note": ""}
    merged = {"total_amount": 2500, "note": "粉白色系"}
    assert compute_changed_fields(baseline, merged, keys=("total_amount", "note")) == [
        "total_amount",
        "note",
    ]


def test_build_draft_update_only_sets_changed_fields():
    draft = OrderDraftOut(
        id=1,
        customer_name="王小明",
        customer_phone="",
        item="母親節花束",
        total_amount=2000,
        order_date=datetime(2026, 6, 6, 10, 0, 0),
        note="",
    )
    merged = {
        "customer_name": "王小明",
        "customer_phone": "0912345678",
        "item": "母親節花束",
        "total_amount": 2500,
        "quantity": None,
        "note": "粉白色系",
        "shipment_method": None,
        "send_datetime": None,
        "delivery_address": None,
        "pay_way": None,
        "pay_status": None,
    }
    update = build_draft_update_from_merged(draft, merged)
    assert set(update.model_fields_set) == {"customer_phone", "total_amount", "note"}
    assert update.customer_phone == "0912345678"


def test_normalize_phone_accepts_plus_886_format():
    assert normalize_phone("+886 912-345-678") == "0912345678"
    assert normalize_phone("886912345678") == "0912345678"


def test_normalize_phone_accepts_landline():
    assert normalize_phone("02-1234-5678") == "0212345678"


def test_normalize_phone_rejects_invalid():
    assert normalize_phone("not-a-phone") is None


def test_is_phone_empty():
    assert is_phone_empty("") is True
    assert is_phone_empty("0911222333") is False


def test_normalize_taipei_datetime_without_z_suffix():
    parsed = normalize_taipei_datetime("2026-06-07T15:00:00")
    assert parsed == datetime(2026, 6, 7, 15, 0, 0)


def test_build_visible_baseline_dict_omits_hidden_optional_fields():
    values = {
        "id": 1,
        "customer_name": "王小明",
        "customer_phone": "0911222333",
        "item": "花束",
        "total_amount": 1000,
        "quantity": 2,
        "note": "舊備註",
        "order_date": "2026-06-06T10:00:00",
    }
    visible = {
        "id",
        "customer_name",
        "customer_phone",
        "item",
        "total_amount",
        "send_datetime",
    }
    baseline = build_visible_baseline_dict(values, visible)
    assert baseline["item"] == "花束"
    assert "note" not in baseline
    assert "quantity" not in baseline


def test_draft_visible_baseline_for_llm_matches_store_config():
    draft = OrderDraftOut(
        id=7,
        customer_name="王小明",
        customer_phone="0911222333",
        item="花束",
        total_amount=1000,
        note="黃色點綴",
        order_date=datetime(2026, 6, 6, 10, 0, 0),
    )
    text = draft_visible_baseline_for_llm(
        draft,
        {"customer_name", "item", "total_amount", "note"},
    )
    assert '"note": "黃色點綴"' in text
    assert "customer_phone" not in text


def test_filter_changed_fields_to_visible():
    changed = ["note", "pay_way", "item"]
    visible = {"item", "note", "total_amount"}
    assert filter_changed_fields_to_visible(changed, visible) == ["note", "item"]


def test_merge_shipment_and_pay_status_enums():
    baseline = {
        "customer_name": "A",
        "customer_phone": "0911000111",
        "item": "花束",
        "total_amount": 1000,
        "quantity": 1,
        "note": None,
        "shipment_method": ShipmentMethod.STORE_PICKUP,
        "send_datetime": None,
        "delivery_address": None,
        "pay_way": None,
        "pay_status": PaymentStatus.PENDING,
    }
    merged = merge_delta_into_catalog(
        baseline,
        {"shipment_method": "DELIVERY", "pay_status": "PAID"},
        flow="draft",
    )
    assert merged["shipment_method"] == ShipmentMethod.DELIVERY
    assert merged["pay_status"] == PaymentStatus.PAID
