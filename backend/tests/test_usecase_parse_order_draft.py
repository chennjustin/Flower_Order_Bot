import json

from app.usecases.organize_order_draft import _parse_order_draft_json


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

