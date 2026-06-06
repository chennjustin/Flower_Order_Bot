"""Step 9 guardrails: display_config shape and DOCX full-catalog context."""

from __future__ import annotations

from app.domain.order_fields import ALL_CATALOG_KEYS, build_display_config
from app.services.order_field_config_service import _load_display_settings
from app.models.order_field_config import StoreOrderFieldConfig


def test_display_config_json_shape_matches_contract() -> None:
    visible = ["customer_name", "item", "quantity"]
    order = ["item", "quantity", "customer_name", "id"]
    payload = build_display_config(visible, order)
    assert set(payload.keys()) == {"visible_fields", "field_order"}
    assert payload["visible_fields"] == visible
    assert payload["field_order"] == order


def test_display_config_round_trip_through_model_row() -> None:
    visible = ["customer_name", "note"]
    order = ["note", "customer_name", "id"]
    row = StoreOrderFieldConfig(
        store_id=2,
        visible_fields=visible,
        display_config=build_display_config(visible, order),
        organize_required_fields=[],
    )
    loaded_visible, loaded_order = _load_display_settings(row)
    assert "customer_name" in loaded_visible
    assert "note" in loaded_visible
    assert loaded_order[:3] == ["note", "customer_name", "id"]


def test_all_catalog_keys_present_in_docx_context_module() -> None:
    from datetime import datetime

    from app.enums.order import OrderStatus
    from app.enums.payment import PaymentStatus
    from app.enums.shipment import ShipmentMethod
    from app.schemas.order import OrderOut
    from app.services.order_field_values import build_docx_catalog_context

    order = OrderOut(
        id=1,
        customer_name="A",
        customer_phone="09",
        order_date=datetime(2026, 1, 1, 10, 0),
        order_status=OrderStatus.CONFIRMED,
        pay_way=None,
        pay_status=PaymentStatus.PENDING,
        total_amount=100.0,
        item="rose",
        quantity=1,
        note=None,
        shipment_method=ShipmentMethod.STORE_PICKUP,
        send_datetime=None,
        delivery_address=None,
    )
    ctx = build_docx_catalog_context(order, ["customer_name"])
    assert set(ctx.keys()) == set(ALL_CATALOG_KEYS)
    assert ctx["customer_name"] == "A"
    assert ctx["item"] == ""
