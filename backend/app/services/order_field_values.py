"""Format order field values for DOCX and other exports."""

from __future__ import annotations

from collections.abc import Iterable
from datetime import datetime
from typing import Any

from app.domain.order_fields import ALL_CATALOG_KEYS, get_field_label, is_catalog_field_key
from app.enums.order import OrderStatus
from app.enums.payment import PaymentStatus
from app.enums.shipment import ShipmentMethod
from app.models.order import OrderDraft
from app.schemas.order import OrderDraftOut, OrderDraftUpdate, OrderOut

NUMERIC_CATALOG_KEYS = frozenset({"total_amount", "quantity"})

WEEKDAY_ZH = {
    "Monday": "星期一",
    "Tuesday": "星期二",
    "Wednesday": "星期三",
    "Thursday": "星期四",
    "Friday": "星期五",
    "Saturday": "星期六",
    "Sunday": "星期日",
}

ORDER_STATUS_LABELS: dict[OrderStatus, str] = {
    OrderStatus.PENDING: "待處理",
    OrderStatus.CONFIRMED: "已確認",
    OrderStatus.CANCELLED: "已取消",
    OrderStatus.COMPLETED: "已完成",
}

PAYMENT_STATUS_LABELS: dict[PaymentStatus, str] = {
    PaymentStatus.PENDING: "待付款",
    PaymentStatus.PAID: "已付款",
    PaymentStatus.FAILED: "付款失敗",
    PaymentStatus.REFUNDED: "已退款",
}

SHIPMENT_METHOD_LABELS: dict[ShipmentMethod, str] = {
    ShipmentMethod.STORE_PICKUP: "店取",
    ShipmentMethod.DELIVERY: "外送",
}


def _format_datetime_cell(value: datetime | None) -> str:
    if value is None:
        return ""
    return value.strftime("%Y-%m-%d %H:%M")


def _format_date_only(value: datetime | None) -> str:
    if value is None:
        return ""
    return value.strftime("%Y-%m-%d")


def _weekday_zh(value: datetime | None) -> str:
    if value is None:
        return ""
    return WEEKDAY_ZH.get(value.strftime("%A"), "")


def _format_shipment(method: ShipmentMethod | None) -> str:
    if method is None:
        return ""
    return SHIPMENT_METHOD_LABELS.get(method, str(method))


def _format_order_status(status: OrderStatus) -> str:
    return ORDER_STATUS_LABELS.get(status, str(status))


def _format_pay_status(status: PaymentStatus | None) -> str:
    if status is None:
        return PAYMENT_STATUS_LABELS[PaymentStatus.PENDING]
    return PAYMENT_STATUS_LABELS.get(status, str(status))


def format_order_field_value(key: str, order: OrderOut) -> str:
    """Plain-text value for one catalog key (aligned with frontend list/CSV)."""
    match key:
        case "id":
            return str(order.id)
        case "customer_name":
            return order.customer_name or ""
        case "customer_phone":
            return order.customer_phone or ""
        case "item":
            return order.item or ""
        case "quantity":
            return str(order.quantity)
        case "note":
            return order.note or ""
        case "shipment_method":
            return _format_shipment(order.shipment_method)
        case "send_datetime":
            return _format_datetime_cell(order.send_datetime)
        case "order_date":
            return _format_datetime_cell(order.order_date)
        case "total_amount":
            return str(order.total_amount)
        case "pay_way":
            return order.pay_way or ""
        case "pay_status":
            return _format_pay_status(order.pay_status)
        case "delivery_address":
            return order.delivery_address or ""
        case "order_status":
            return _format_order_status(order.order_status)
        case _:
            return ""


def build_order_field_context(
    order: OrderOut, visible_fields: list[str]
) -> dict[str, str]:
    """Catalog-key context for visible fields only."""
    context: dict[str, str] = {}
    for key in visible_fields:
        if not is_catalog_field_key(key):
            continue
        context[key] = format_order_field_value(key, order)
    return context


def build_legacy_docx_context(order: OrderOut) -> dict[str, Any]:
    """Legacy template variable names (order_template.docx); all fields shown."""
    return _build_legacy_docx_context_masked(order, frozenset(ALL_CATALOG_KEYS))


def _build_legacy_docx_context_masked(
    order: OrderOut, visible: frozenset[str]
) -> dict[str, Any]:
    """Legacy docx placeholders; hidden catalog fields render as empty."""
    send_dt = order.send_datetime if "send_datetime" in visible else None
    order_date = order.order_date if "order_date" in visible else None

    def _str_field(key: str, value: str | None) -> str:
        if key not in visible:
            return ""
        return value or ""

    delivery = _str_field("delivery_address", order.delivery_address)
    pay_way = _str_field("pay_way", order.pay_way)
    return {
        "customer_name": _str_field("customer_name", order.customer_name),
        "phone": _str_field("customer_phone", order.customer_phone),
        "timestamp": _format_date_only(order_date) if "order_date" in visible else "",
        "item": _str_field("item", order.item),
        "quantity": order.quantity if "quantity" in visible else "",
        "pay_way": pay_way,
        # Aliases used by legacy order_template.docx placeholders.
        "payway": pay_way,
        "note": _str_field("note", order.note),
        "weekday": _weekday_zh(send_dt) if "send_datetime" in visible else "",
        "send_datetime": _format_datetime_cell(send_dt) if "send_datetime" in visible else "",
        "receiver_name": _str_field("customer_name", order.customer_name),
        "receiver_phone": _str_field("customer_phone", order.customer_phone),
        "delivery_address": delivery,
        "receipt_address": delivery,
        "card_message": "",
        "total_amount": order.total_amount if "total_amount" in visible else "",
    }


def build_docx_catalog_context(
    order: OrderOut, visible_fields: list[str]
) -> dict[str, str]:
    """Every catalog key for docxtpl; hidden fields are empty strings."""
    visible = frozenset(visible_fields)
    return {
        key: format_order_field_value(key, order) if key in visible else ""
        for key in ALL_CATALOG_KEYS
    }


def build_docx_render_context(order: OrderOut, visible_fields: list[str]) -> dict[str, Any]:
    """
    Full DOCX context: legacy aliases + all catalog keys.

    Template placeholders stay defined for every key; store-hidden fields are "".
    """
    visible = frozenset(visible_fields)
    return {
        **_build_legacy_docx_context_masked(order, visible),
        **build_docx_catalog_context(order, visible_fields),
    }


def build_docx_render_context_full_catalog(
    order: OrderOut, visible_fields: list[str]
) -> dict[str, Any]:
    """Alias for build_docx_render_context (multi-store DOCX Step 5)."""
    return build_docx_render_context(order, visible_fields)


def is_catalog_value_empty(key: str, value: object) -> bool:
    """True when a required catalog field has no usable value."""
    if key in NUMERIC_CATALOG_KEYS:
        if value is None:
            return True
        if isinstance(value, (int, float)):
            return value <= 0
        return True
    return value in (None, "")


def draft_out_catalog_values(
    draft: OrderDraftOut,
    update: OrderDraftUpdate | None = None,
) -> dict[str, object]:
    """Merge draft snapshot with pending update using catalog keys."""
    upd = update or OrderDraftUpdate()
    return {
        "customer_name": upd.customer_name or draft.customer_name,
        "customer_phone": upd.customer_phone or draft.customer_phone,
        "item": upd.item or draft.item,
        "send_datetime": upd.send_datetime or draft.send_datetime,
        "total_amount": (
            upd.total_amount if upd.total_amount is not None else draft.total_amount
        ),
        "quantity": upd.quantity if upd.quantity is not None else draft.quantity,
        "note": upd.note or draft.note,
        "shipment_method": upd.shipment_method or draft.shipment_method,
        "delivery_address": upd.delivery_address or draft.delivery_address,
        "pay_way": upd.pay_way or draft.pay_way,
        "pay_status": upd.pay_status or draft.pay_status,
    }


def order_draft_catalog_values(
    order_draft: OrderDraft,
    customer: object | None,
) -> dict[str, object]:
    """Map ORM draft (+ customer) to catalog keys for validation."""
    name = getattr(customer, "name", None) if customer else None
    phone = getattr(customer, "phone", None) if customer else None
    return {
        "customer_name": name,
        "customer_phone": phone,
        "item": order_draft.item_type,
        "send_datetime": order_draft.delivery_datetime,
        "total_amount": order_draft.total_amount,
        "quantity": order_draft.quantity,
        "note": order_draft.notes,
        "shipment_method": order_draft.shipment_method,
        "delivery_address": order_draft.delivery_address,
        "pay_way": order_draft.pay_way,
        "pay_status": order_draft.pay_status,
    }


def collect_missing_catalog_keys(
    effective_values: dict[str, object],
    required_fields: Iterable[str],
) -> list[str]:
    """Return missing field keys in required_fields order."""
    missing: list[str] = []
    for key in required_fields:
        if not is_catalog_field_key(key):
            continue
        if is_catalog_value_empty(key, effective_values.get(key)):
            missing.append(key)
    return missing


def collect_missing_catalog_labels(
    effective_values: dict[str, object],
    required_fields: Iterable[str],
) -> list[str]:
    """Return registry labels for missing required fields (LINE messages)."""
    return [get_field_label(key) for key in collect_missing_catalog_keys(effective_values, required_fields)]
