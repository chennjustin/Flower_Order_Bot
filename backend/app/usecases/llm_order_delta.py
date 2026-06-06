from __future__ import annotations

import json
import logging
import re
from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from app.adapters.llm.json_extract import JsonExtractError, extract_json_object
from app.core.time import now_taipei_naive, to_taipei_naive
from app.enums.payment import PaymentStatus
from app.enums.shipment import ShipmentMethod
from app.models.chat import ChatMessage
from app.schemas.order import OrderDraftOut, OrderDraftUpdate, OrderOut, OrderPatchUpdate

logger = logging.getLogger(__name__)

FlowKind = Literal["draft", "order_suggest"]

# Catalog keys tracked for changed_fields (aligned with order_fields.py).
DELTA_CATALOG_KEYS: tuple[str, ...] = (
    "customer_name",
    "customer_phone",
    "pay_way",
    "pay_status",
    "total_amount",
    "item",
    "quantity",
    "note",
    "shipment_method",
    "send_datetime",
    "delivery_address",
)

TW_MOBILE_RE = re.compile(r"^09\d{8}$")
# Taiwan landline / other local numbers (0 + 7–10 digits).
TW_LOCAL_PHONE_RE = re.compile(r"^0\d{7,10}$")


def build_chat_text(messages: list[ChatMessage]) -> str:
    """Format messages in chronological order with explicit Taipei timestamps."""

    lines: list[str] = []
    for message in messages:
        ts = to_taipei_naive(message.created_at).strftime("%Y-%m-%d %H:%M:%S")
        lines.append(f"[{ts} Asia/Taipei] {message.direction}: {message.text}")
    return "\n".join(lines)


def serialize_baseline(model: BaseModel) -> str:
    """Pretty-print baseline JSON without double-encoding."""

    return json.dumps(model.model_dump(mode="json"), ensure_ascii=False, indent=2)


# Read-only keys that may appear in LLM baseline when the store shows them in UI.
_BASELINE_READONLY_KEYS: tuple[str, ...] = ("id", "order_date", "order_status")


def build_visible_baseline_dict(
    values: dict[str, object],
    visible_fields: set[str],
) -> dict[str, object]:
    """Subset baseline to store-visible catalog keys (matches right-panel draft fields)."""

    payload: dict[str, object] = {}
    for key in _BASELINE_READONLY_KEYS:
        if key in visible_fields and key in values:
            payload[key] = values[key]
    for key in DELTA_CATALOG_KEYS:
        if key in visible_fields:
            payload[key] = values.get(key)
    return payload


def serialize_visible_baseline(values: dict[str, object], visible_fields: set[str]) -> str:
    """Pretty-print a visibility-scoped baseline for LLM prompts."""

    return json.dumps(
        build_visible_baseline_dict(values, visible_fields),
        ensure_ascii=False,
        indent=2,
        default=str,
    )


def draft_visible_baseline_for_llm(draft: OrderDraftOut, visible_fields: set[str]) -> str:
    """Build draft baseline JSON limited to fields the store configured as visible."""

    return serialize_visible_baseline(draft.model_dump(mode="json"), visible_fields)


def order_visible_baseline_for_llm(order: OrderOut, visible_fields: set[str]) -> str:
    """Build formal-order baseline JSON limited to store-visible fields."""

    return serialize_visible_baseline(order.model_dump(mode="json"), visible_fields)


def filter_changed_fields_to_visible(
    changed_fields: list[str],
    visible_fields: set[str],
) -> list[str]:
    """Keep changed_fields aligned with fields the store exposes (API highlight contract)."""

    visible = set(visible_fields)
    return [key for key in changed_fields if key in visible]


def reference_now_taipei() -> str:
    """Current Taipei wall time for relative date resolution in prompts."""

    return now_taipei_naive().strftime("%Y-%m-%dT%H:%M:%S Asia/Taipei")


def is_phone_empty(value: str | None) -> bool:
    return not (value or "").strip()


def normalize_phone(value: object) -> str | None:
    """Normalize Taiwan phone numbers (mobile, +886, landline); None when invalid."""

    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None

    # Strip common separators; keep digits for normalization.
    compact = re.sub(r"[\s\-().]", "", text)
    if compact.startswith("+"):
        compact = compact[1:]
    if compact.startswith("886"):
        compact = "0" + compact[3:]

    digits = re.sub(r"\D", "", compact)
    if TW_MOBILE_RE.match(digits):
        return digits
    if TW_LOCAL_PHONE_RE.match(digits):
        return digits

    logger.warning("Skipping invalid phone delta value: %r", value)
    return None


def normalize_payment_status(value: object) -> PaymentStatus | None:
    if value is None:
        return None
    if isinstance(value, PaymentStatus):
        return value
    text = str(value).strip().upper()
    if not text:
        return None
    aliases = {
        "PENDING": PaymentStatus.PENDING,
        "UNPAID": PaymentStatus.PENDING,
        "未付款": PaymentStatus.PENDING,
        "PAID": PaymentStatus.PAID,
        "已付款": PaymentStatus.PAID,
        "FAILED": PaymentStatus.FAILED,
        "付款失敗": PaymentStatus.FAILED,
        "REFUNDED": PaymentStatus.REFUNDED,
        "已退款": PaymentStatus.REFUNDED,
    }
    return aliases.get(text)


def normalize_shipment_method(value: object) -> ShipmentMethod | None:
    if value is None:
        return None
    if isinstance(value, ShipmentMethod):
        return value
    text = str(value).strip().upper()
    if not text:
        return None
    try:
        return ShipmentMethod(text)
    except ValueError:
        logger.warning("Skipping invalid shipment_method delta: %r", value)
        return None


def normalize_taipei_datetime(value: object) -> datetime | None:
    """Parse LLM datetime strings as Asia/Taipei wall time."""

    if value is None:
        return None
    if isinstance(value, datetime):
        return to_taipei_naive(value)
    text = str(value).strip()
    if not text:
        return None
    # Accept ISO with optional +08:00 or trailing Z (treat Z as Taipei per legacy outputs).
    normalized = text.replace("Z", "+00:00") if text.endswith("Z") else text
    try:
        parsed = datetime.fromisoformat(normalized)
    except ValueError:
        logger.warning("Skipping invalid datetime delta: %r", value)
        return None
    return to_taipei_naive(parsed)


def _clean_delta_value(key: str, value: object) -> object:
    if isinstance(value, str) and value.strip() == "":
        return None
    if key == "customer_phone":
        return normalize_phone(value)
    if key == "pay_status":
        return normalize_payment_status(value)
    if key == "shipment_method":
        return normalize_shipment_method(value)
    if key in {"send_datetime", "order_date"}:
        return normalize_taipei_datetime(value)
    return value


def parse_delta_dict(raw_delta: dict) -> dict[str, object]:
    """Normalize and filter a raw LLM delta object."""

    cleaned: dict[str, object] = {}
    for key, value in raw_delta.items():
        if key not in DELTA_CATALOG_KEYS and key != "order_date":
            continue
        cleaned[key] = _clean_delta_value(key, value)
    return cleaned


def parse_delta_json(gpt_reply: str) -> dict[str, object]:
    """Extract and normalize a delta JSON object from raw LLM text."""

    try:
        raw = extract_json_object(gpt_reply)
    except JsonExtractError as exc:
        raise JsonExtractError(str(exc)) from exc
    return parse_delta_dict(raw)


def draft_out_to_catalog_values(draft: OrderDraftOut) -> dict[str, object]:
    return {
        "customer_name": draft.customer_name,
        "customer_phone": draft.customer_phone,
        "pay_way": draft.pay_way,
        "pay_status": draft.pay_status,
        "total_amount": draft.total_amount,
        "item": draft.item,
        "quantity": draft.quantity,
        "note": draft.note,
        "shipment_method": draft.shipment_method,
        "send_datetime": draft.send_datetime,
        "delivery_address": draft.delivery_address,
    }


def order_out_to_catalog_values(order: OrderOut) -> dict[str, object]:
    return {
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "pay_way": order.pay_way,
        "pay_status": order.pay_status,
        "total_amount": order.total_amount,
        "item": order.item,
        "quantity": order.quantity,
        "note": order.note,
        "shipment_method": order.shipment_method,
        "send_datetime": order.send_datetime,
        "delivery_address": order.delivery_address,
    }


def _effective_value(value: object) -> object:
    if isinstance(value, str) and not value.strip():
        return None
    return value


def compute_changed_fields(
    baseline: dict[str, object],
    merged: dict[str, object],
    *,
    keys: tuple[str, ...] = DELTA_CATALOG_KEYS,
) -> list[str]:
    changed: list[str] = []
    for key in keys:
        if _effective_value(baseline.get(key)) != _effective_value(merged.get(key)):
            changed.append(key)
    return changed


def _is_field_allowed_in_delta(key: str, *, flow: FlowKind) -> bool:
    if key == "customer_name":
        return False
    if key == "customer_phone":
        # Draft: customer may provide a different contact number in chat.
        return flow == "draft"
    if key == "order_date":
        return flow == "draft"
    return key in DELTA_CATALOG_KEYS


def merge_delta_into_catalog(
    baseline: dict[str, object],
    delta: dict[str, object],
    *,
    flow: FlowKind,
) -> dict[str, object]:
    """Apply validated delta onto baseline catalog values."""

    merged = dict(baseline)

    for key, value in delta.items():
        if key == "order_date":
            continue
        if not _is_field_allowed_in_delta(key, flow=flow):
            continue
        if key == "customer_phone":
            normalized = normalize_phone(value)
            if normalized is None:
                continue
            merged[key] = normalized
            continue
        if value is None and key in {
            "note",
            "delivery_address",
            "pay_way",
            "item",
            "shipment_method",
            "send_datetime",
            "pay_status",
        }:
            merged[key] = None
            continue
        if key == "pay_status":
            normalized = normalize_payment_status(value)
            if normalized is None:
                continue
            merged[key] = normalized
            continue
        if key == "shipment_method":
            normalized = normalize_shipment_method(value)
            if normalized is None:
                continue
            merged[key] = normalized
            continue
        if key == "send_datetime":
            normalized = normalize_taipei_datetime(value)
            merged[key] = normalized
            continue
        merged[key] = value

    return merged


def build_draft_update_from_merged(
    baseline: OrderDraftOut,
    merged: dict[str, object],
) -> OrderDraftUpdate:
    """Build a partial OrderDraftUpdate containing only fields that changed."""

    baseline_values = draft_out_to_catalog_values(baseline)
    changed_keys = compute_changed_fields(baseline_values, merged)
    payload: dict[str, object] = {}
    for key in changed_keys:
        payload[key] = merged.get(key)
    return OrderDraftUpdate(**payload)


def build_order_patch_from_merged(
    order: OrderOut,
    merged: dict[str, object],
) -> OrderPatchUpdate:
    """Build merged OrderPatchUpdate preview for suggest-from-chat."""

    baseline_values = order_out_to_catalog_values(order)

    def pick_str(current: str | None, new: object) -> str | None:
        if new is None:
            return current
        return str(new)

    def pick_num(current: float | int | None, new: object) -> float | int | None:
        if new is None:
            return current
        return new  # type: ignore[return-value]

    return OrderPatchUpdate(
        customer_name=order.customer_name,
        customer_phone=order.customer_phone,
        total_amount=pick_num(order.total_amount, merged.get("total_amount")),
        pay_status=merged.get("pay_status") or order.pay_status,  # type: ignore[arg-type]
        item=pick_str(order.item, merged.get("item")),
        quantity=pick_num(order.quantity, merged.get("quantity")),  # type: ignore[arg-type]
        note=pick_str(order.note, merged.get("note")),
        shipment_method=merged.get("shipment_method") or order.shipment_method,  # type: ignore[arg-type]
        send_datetime=merged.get("send_datetime") or order.send_datetime,  # type: ignore[arg-type]
        delivery_address=pick_str(order.delivery_address, merged.get("delivery_address")),
        pay_way=pick_str(order.pay_way, merged.get("pay_way")),
        order_status=order.order_status,
    )
