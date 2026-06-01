from app.domain.order_fields import FIELD_LABELS, FIXED_VISIBLE_FIELDS
from app.services.order_field_config_service import (
    _normalize_organize_required_fields,
    _normalize_visible_fields,
    _resolve_optional_required_fields,
)


def test_field_labels_cover_all_catalog_keys() -> None:
    from app.domain.order_fields import ALL_CATALOG_KEYS

    for key in ALL_CATALOG_KEYS:
        assert key in FIELD_LABELS
        assert FIELD_LABELS[key]


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


def test_resolve_optional_required_fields_uses_visible_and_manual() -> None:
    visible_fields = _normalize_visible_fields(["quantity", "note"])
    fields = _resolve_optional_required_fields(
        visible_fields=visible_fields,
        organize_required_fields=["delivery_address"],
    )
    assert fields == ["quantity", "note", "delivery_address"]
