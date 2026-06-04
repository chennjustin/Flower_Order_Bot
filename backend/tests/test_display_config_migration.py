"""Unit tests for display_config JSON helpers (Step 1 schema)."""

from app.domain.order_fields import ALL_CATALOG_KEYS, build_display_config


def test_build_display_config_defaults_field_order_to_catalog() -> None:
    visible = ["id", "customer_name", "item"]
    payload = build_display_config(visible)
    assert payload["visible_fields"] == visible
    assert payload["field_order"] == list(ALL_CATALOG_KEYS)


def test_build_display_config_preserves_custom_field_order() -> None:
    order = ["item", "customer_name", "id"]
    payload = build_display_config(["item"], field_order=order)
    assert payload["field_order"] == order
