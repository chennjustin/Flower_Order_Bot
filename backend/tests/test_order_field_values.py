from datetime import datetime

from app.enums.order import OrderStatus
from app.enums.payment import PaymentStatus
from app.enums.shipment import ShipmentMethod
from app.schemas.order import OrderOut
from app.services.order_field_values import (
    build_docx_render_context,
    build_legacy_docx_context,
    build_order_field_context,
    format_order_field_value,
)


def _sample_order() -> OrderOut:
    return OrderOut(
        id=42,
        customer_name="Amy",
        customer_phone="0912345678",
        order_date=datetime(2026, 6, 1, 10, 30),
        order_status=OrderStatus.CONFIRMED,
        pay_way="轉帳",
        pay_status=PaymentStatus.PENDING,
        total_amount=1200.0,
        item="花束",
        quantity=1,
        note="粉色系",
        shipment_method=ShipmentMethod.DELIVERY,
        send_datetime=datetime(2026, 6, 2, 14, 0),
        delivery_address="台北市",
    )


def test_format_order_field_value_uses_catalog_formatting() -> None:
    order = _sample_order()
    assert format_order_field_value("customer_name", order) == "Amy"
    assert format_order_field_value("shipment_method", order) == "外送"
    assert format_order_field_value("pay_status", order) == "待付款"
    assert "2026-06-02 14:00" in format_order_field_value("send_datetime", order)


def test_build_order_field_context_respects_visible_fields() -> None:
    order = _sample_order()
    ctx = build_order_field_context(order, ["customer_name", "pay_status", "bad_key"])
    assert set(ctx.keys()) == {"customer_name", "pay_status"}
    assert ctx["customer_name"] == "Amy"


def test_build_legacy_docx_context_keeps_template_keys() -> None:
    order = _sample_order()
    legacy = build_legacy_docx_context(order)
    assert legacy["phone"] == "0912345678"
    assert legacy["receiver_name"] == "Amy"
    assert legacy["timestamp"] == "2026-06-01"
    assert legacy["weekday"]


def test_build_docx_render_context_merges_legacy_and_catalog() -> None:
    order = _sample_order()
    merged = build_docx_render_context(order, ["id", "item"])
    assert merged["phone"] == "0912345678"
    assert merged["id"] == "42"
    assert merged["item"] == "花束"
