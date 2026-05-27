import json
from datetime import datetime

from app.schemas.order import OrderDraftOut, OrderDraftUpdate
from app.usecases.organize_order_draft import _collect_missing_fields, _parse_order_draft_json


def test_parse_order_draft_json_minimal_fields():
    payload = {
        "customer_name": "A",
        "customer_phone": "0912",
        "pay_way": "CASH",
        "total_amount": 1000,
        "item": "rose",
        "quantity": 1,
        "note": "",
        "shipment_method": "DELIVERY",
        "send_datetime": None,
        "delivery_address": "addr",
    }
    upd = _parse_order_draft_json(json.dumps(payload))
    assert upd.customer_name == "A"
    assert upd.delivery_address == "addr"
    assert upd.receiver_name is None
    assert upd.receiver_phone is None


def test_parse_order_draft_json_ignores_legacy_receiver_fields():
    payload = {
        "customer_name": "A",
        "customer_phone": "0912",
        "receiver_name": "LegacyReceiver",
        "receiver_phone": "0999",
        "item": "rose",
        "send_datetime": None,
        "total_amount": 800,
    }

    upd = _parse_order_draft_json(json.dumps(payload))
    assert upd.customer_name == "A"
    assert upd.receiver_name is None
    assert upd.receiver_phone is None


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

