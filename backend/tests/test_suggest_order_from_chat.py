from datetime import datetime

from app.enums.order import OrderStatus
from app.enums.payment import PaymentStatus
from app.enums.shipment import ShipmentMethod
from app.schemas.order import OrderDraftUpdate, OrderOut
from app.usecases.llm_order_delta import compute_changed_fields, order_out_to_catalog_values
from app.usecases.suggest_order_from_chat import _merge_llm_update_into_patch


def test_merge_llm_update_into_patch_applies_customer_phone():
    order_out = OrderOut(
        id=10,
        customer_name="王小明",
        customer_phone="0911222333",
        order_date=datetime(2026, 5, 1, 10, 0, 0),
        order_status=OrderStatus.CONFIRMED,
        pay_way="轉帳",
        pay_status=PaymentStatus.PENDING,
        total_amount=1000,
        item="玫瑰花束",
        quantity=1,
        note="",
        shipment_method=ShipmentMethod.DELIVERY,
        send_datetime=datetime(2026, 5, 2, 15, 0, 0),
        delivery_address="台北市",
    )
    update = OrderDraftUpdate(customer_phone="0999888777")
    patch = _merge_llm_update_into_patch(order_out, update)
    assert patch.customer_name == "王小明"
    assert patch.customer_phone == "0999888777"


def test_merge_llm_update_into_patch_keeps_customer_and_applies_item():
    order_out = OrderOut(
        id=10,
        customer_name="王小明",
        customer_phone="0911222333",
        order_date=datetime(2026, 5, 1, 10, 0, 0),
        order_status=OrderStatus.CONFIRMED,
        pay_way="轉帳",
        pay_status=PaymentStatus.PENDING,
        total_amount=1000,
        item="玫瑰花束",
        quantity=1,
        note="",
        shipment_method=ShipmentMethod.DELIVERY,
        send_datetime=datetime(2026, 5, 2, 15, 0, 0),
        delivery_address="台北市",
    )
    update = OrderDraftUpdate(item="百合花束", quantity=2)
    patch = _merge_llm_update_into_patch(order_out, update)
    assert patch.customer_name == "王小明"
    assert patch.item == "百合花束"
    assert patch.quantity == 2
    assert patch.total_amount == 1000


def test_compute_changed_fields_for_suggest_merge():
    order_out = OrderOut(
        id=10,
        customer_name="王小明",
        customer_phone="0911222333",
        order_date=datetime(2026, 5, 1, 10, 0, 0),
        order_status=OrderStatus.CONFIRMED,
        pay_way="轉帳",
        pay_status=PaymentStatus.PENDING,
        total_amount=1000,
        item="玫瑰花束",
        quantity=1,
        note="",
        shipment_method=ShipmentMethod.DELIVERY,
        send_datetime=datetime(2026, 5, 2, 15, 0, 0),
        delivery_address="台北市",
    )
    baseline = order_out_to_catalog_values(order_out)
    merged = dict(baseline)
    merged["item"] = "百合花束"
    merged["quantity"] = 2
    changed = compute_changed_fields(baseline, merged)
    assert "item" in changed
    assert "quantity" in changed
    assert "customer_phone" not in changed
