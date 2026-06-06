from app.domain.order_fields import ALL_CATALOG_KEYS, FIELD_LABELS, FIXED_VISIBLE_FIELDS, build_display_config
from app.domain.order_fields import CORE_ORGANIZE_FIELDS
from app.services.order_field_config_service import (
    _load_display_settings,
    _normalize_field_order,
    _normalize_organize_required_fields,
    _normalize_visible_fields,
    _order_visible_by_field_order,
    _persist_display_settings,
    _resolve_optional_required_fields,
)
from app.models.order_field_config import StoreOrderFieldConfig


def test_field_labels_cover_all_catalog_keys() -> None:
    for key in ALL_CATALOG_KEYS:
        assert key in FIELD_LABELS
        assert FIELD_LABELS[key]


def test_normalize_visible_fields_keeps_fixed_and_filters_invalid() -> None:
    fields = _normalize_visible_fields(["quantity", "id", "bad_field", "pay_status"])
    assert fields[: len(FIXED_VISIBLE_FIELDS)] == list(FIXED_VISIBLE_FIELDS)
    assert "quantity" in fields
    assert "pay_status" in fields
    assert "bad_field" not in fields


def test_normalize_visible_fields_none_shows_all_catalog_fields() -> None:
    fields = _normalize_visible_fields(None)
    assert set(fields) == set(ALL_CATALOG_KEYS)
    assert "quantity" in fields
    assert "pay_status" in fields
    assert "order_date" in fields


def test_normalize_field_order_preserves_custom_sequence_and_appends_missing() -> None:
    order = _normalize_field_order(["item", "customer_name", "id"])
    assert order[:3] == ["item", "customer_name", "id"]
    assert set(order) == set(ALL_CATALOG_KEYS)


def test_normalize_field_order_filters_invalid_keys() -> None:
    order = _normalize_field_order(["item", "not_a_field", "note"])
    assert "not_a_field" not in order
    assert "item" in order
    assert "note" in order


def test_order_visible_by_field_order() -> None:
    visible = _normalize_visible_fields(["quantity", "pay_status", "id"])
    field_order = ["pay_status", "item", "quantity", "id", "customer_name"]
    ordered = _order_visible_by_field_order(visible, field_order)
    pay_idx = ordered.index("pay_status")
    qty_idx = ordered.index("quantity")
    id_idx = ordered.index("id")
    assert pay_idx < qty_idx < id_idx


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


def test_effective_organize_required_includes_core_plus_visible_optional() -> None:
    visible_fields = _normalize_visible_fields(["quantity", "pay_status"])
    optional_required = _resolve_optional_required_fields(visible_fields, [])
    effective = [*CORE_ORGANIZE_FIELDS, *optional_required]
    assert set(CORE_ORGANIZE_FIELDS) <= set(effective)
    assert "quantity" in effective
    assert "pay_status" in effective
    assert "note" not in effective


def test_load_display_settings_from_display_config_json() -> None:
    row = StoreOrderFieldConfig(
        store_id=1,
        visible_fields=["legacy"],
        display_config={
            "visible_fields": ["quantity", "id"],
            "field_order": ["quantity", "item", "id"],
        },
        organize_required_fields=[],
    )
    visible, field_order = _load_display_settings(row)
    assert "quantity" in visible
    assert field_order[:3] == ["quantity", "item", "id"]


def test_persist_display_settings_updates_both_columns() -> None:
    row = StoreOrderFieldConfig(
        store_id=1,
        visible_fields=[],
        display_config={"visible_fields": [], "field_order": list(ALL_CATALOG_KEYS)},
        organize_required_fields=[],
    )
    visible = _normalize_visible_fields(["note"])
    order = ["note", "item", "customer_name"]
    _persist_display_settings(row, visible, order)
    assert row.visible_fields == visible
    assert row.display_config["visible_fields"] == visible
    assert row.display_config["field_order"] == order


def test_partial_update_visible_only_keeps_field_order() -> None:
    original_order = ["item", "customer_name", "id"]
    row = StoreOrderFieldConfig(
        store_id=1,
        visible_fields=_normalize_visible_fields(None),
        display_config=build_display_config(_normalize_visible_fields(None), original_order),
        organize_required_fields=[],
    )
    _visible_before, order_before = _load_display_settings(row)
    new_visible = _normalize_visible_fields(["quantity"])
    _persist_display_settings(row, new_visible, order_before)
    visible_after, order_after = _load_display_settings(row)
    assert order_after == order_before
    assert "quantity" in visible_after


def test_partial_update_field_order_only_keeps_visible() -> None:
    visible = _normalize_visible_fields(["quantity", "note"])
    row = StoreOrderFieldConfig(
        store_id=1,
        visible_fields=visible,
        display_config=build_display_config(visible, list(ALL_CATALOG_KEYS)),
        organize_required_fields=[],
    )
    new_order = ["note", "quantity", "item"]
    _persist_display_settings(row, visible, _normalize_field_order(new_order))
    visible_after, order_after = _load_display_settings(row)
    assert set(visible_after) == set(visible)
    assert order_after[:3] == ["note", "quantity", "item"]
