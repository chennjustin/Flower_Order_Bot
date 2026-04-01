import json

from app.usecases.organize_order_draft import _parse_order_draft_json


def test_parse_order_draft_json_minimal_fields():
    payload = {
        "customer_name": "A",
        "customer_phone": "0912",
        "receiver_name": "B",
        "receiver_phone": "0922",
        "pay_way": "CASH",
        "total_amount": 1000,
        "item": "rose",
        "quantity": 1,
        "note": "",
        "card_message": "",
        "shipment_method": "DELIVERY",
        "send_datetime": None,
        "receipt_address": "",
        "delivery_address": "addr",
    }
    upd = _parse_order_draft_json(json.dumps(payload))
    assert upd.customer_name == "A"
    assert upd.delivery_address == "addr"

