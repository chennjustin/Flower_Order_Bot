from datetime import datetime

from app.domain.order_fields import CORE_ORGANIZE_FIELDS
from app.schemas.order import OrderDraftOut, OrderDraftUpdate
from app.services.order_field_values import (
    collect_missing_catalog_keys,
    collect_missing_catalog_labels,
    is_catalog_value_empty,
)


def test_is_catalog_value_empty_for_customer_phone() -> None:
    assert is_catalog_value_empty("customer_phone", None) is True
    assert is_catalog_value_empty("customer_phone", "") is True
    assert is_catalog_value_empty("customer_phone", "   ") is True
    assert is_catalog_value_empty("customer_phone", "0911222333") is False


def test_is_catalog_value_empty_for_numeric_fields() -> None:
    assert is_catalog_value_empty("total_amount", None) is True
    assert is_catalog_value_empty("total_amount", -1) is True
    assert is_catalog_value_empty("total_amount", 100) is False
    assert is_catalog_value_empty("quantity", 0) is True


def test_collect_missing_catalog_labels_uses_registry() -> None:
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
    effective = {
        "customer_name": draft.customer_name,
        "customer_phone": draft.customer_phone,
        "item": draft.item,
        "send_datetime": draft.send_datetime,
        "total_amount": draft.total_amount,
        "quantity": None,
    }
    required = [*CORE_ORGANIZE_FIELDS, "quantity"]
    labels = collect_missing_catalog_labels(effective, required)
    assert labels == ["數量"]

    keys = collect_missing_catalog_keys(effective, required)
    assert keys == ["quantity"]
