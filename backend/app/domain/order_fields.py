"""Canonical order field catalog (v1).

Keys and Traditional Chinese labels must stay aligned with
``frontend/src/config/orderDisplayFields.ts`` (ORDER_FIELD_REGISTRY).
"""

from __future__ import annotations

from typing import Final

# ---------------------------------------------------------------------------
# Visibility / organize rules (backend normalization)
# ---------------------------------------------------------------------------

# Always present in normalized visible_fields (fixed prefix, in this order).
FIXED_VISIBLE_FIELDS: Final[tuple[str, ...]] = (
    "id",
    "customer_name",
    "customer_phone",
    "item",
    "order_status",
    "send_datetime",
    "total_amount",
)

# May be included in visible_fields when selected by the store.
OPTIONAL_VISIBLE_FIELDS: Final[tuple[str, ...]] = (
    "quantity",
    "note",
    "shipment_method",
    "delivery_address",
    "pay_way",
    "pay_status",
    "order_date",
)

# Optional fields that may be required for LLM organize / draft validation.
OPTIONAL_ORGANIZE_FIELDS: Final[tuple[str, ...]] = (
    "quantity",
    "note",
    "shipment_method",
    "delivery_address",
    "pay_way",
    "pay_status",
)

# Always required for organize and create-order validation (effective config).
CORE_ORGANIZE_FIELDS: Final[tuple[str, ...]] = (
    "customer_name",
    "customer_phone",
    "item",
    "send_datetime",
    "total_amount",
)

ALL_CATALOG_KEYS: Final[tuple[str, ...]] = FIXED_VISIBLE_FIELDS + OPTIONAL_VISIBLE_FIELDS

# ---------------------------------------------------------------------------
# Display labels (registry)
# ---------------------------------------------------------------------------

FIELD_LABELS: Final[dict[str, str]] = {
    "id": "訂單編號",
    "customer_name": "顧客姓名",
    "customer_phone": "顧客電話",
    "item": "品項",
    "quantity": "數量",
    "note": "備註",
    "shipment_method": "取貨方式",
    "send_datetime": "取貨時間",
    "total_amount": "總金額",
    "pay_way": "付款方式",
    "pay_status": "付款狀態",
    "delivery_address": "送貨地址",
    "order_date": "訂單日期",
    "order_status": "狀態",
}


def get_field_label(key: str) -> str:
    """Return the registry label for a catalog field key."""
    try:
        return FIELD_LABELS[key]
    except KeyError as exc:
        raise KeyError(f"Unknown order field key: {key}") from exc


def is_catalog_field_key(key: str) -> bool:
    return key in FIELD_LABELS
