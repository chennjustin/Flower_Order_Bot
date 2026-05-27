from app.services.order_field_config_service import (
    FIXED_VISIBLE_FIELDS,
    _normalize_organize_required_fields,
    _normalize_visible_fields,
)


def test_normalize_visible_fields_keeps_fixed_and_filters_invalid() -> None:
    fields = _normalize_visible_fields(["quantity", "id", "bad_field", "pay_status"])
    assert fields[: len(FIXED_VISIBLE_FIELDS)] == list(FIXED_VISIBLE_FIELDS)
    assert "quantity" in fields
    assert "pay_status" in fields
    assert "bad_field" not in fields


def test_normalize_organize_required_fields_filters_to_optional() -> None:
    fields = _normalize_organize_required_fields(
        ["quantity", "delivery_address", "customer_name", "not_exist"]
    )
    assert fields == ["quantity", "delivery_address"]
