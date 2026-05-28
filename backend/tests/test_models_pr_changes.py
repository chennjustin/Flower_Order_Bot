"""Tests for ORM model changes introduced in the multitenant PR.

These tests verify model structure (table names, column presence, defaults,
relationships, backward-compat properties) without requiring a real database
connection.  SQLAlchemy model metadata is inspected directly.
"""

import pytest
from sqlalchemy import inspect as sa_inspect

from app.models.customer import Customer
from app.models.chat import ChatRoom, ChatMessage
from app.models.order import Order, OrderDraft
from app.models.order_field_config import StoreOrderFieldConfig
from app.models.payment import Payment, PaymentMethod
from app.models.operation import Notification
from app.models.store import Store


# ---------------------------------------------------------------------------
# Helper – column name set from mapper
# ---------------------------------------------------------------------------


def _column_names(model_cls) -> set[str]:
    return {col.key for col in sa_inspect(model_cls).mapper.column_attrs}


# ---------------------------------------------------------------------------
# Customer (new model)
# ---------------------------------------------------------------------------


def test_customer_tablename():
    assert Customer.__tablename__ == "customer"


def test_customer_has_required_columns():
    cols = _column_names(Customer)
    for required in ("id", "line_uid", "name", "phone", "avatar_url", "has_ordered", "store_id"):
        assert required in cols, f"Missing column: {required}"


def test_customer_has_store_relationship():
    rel_names = {r.key for r in sa_inspect(Customer).mapper.relationships}
    assert "store" in rel_names
    assert "chat_rooms" in rel_names
    assert "orders" in rel_names
    assert "order_drafts" in rel_names


# ---------------------------------------------------------------------------
# ChatRoom – multi-tenant changes + backward-compat properties
# ---------------------------------------------------------------------------


def test_chat_room_tablename():
    assert ChatRoom.__tablename__ == "chat_room"


def test_chat_room_has_store_id_and_customer_id():
    cols = _column_names(ChatRoom)
    assert "store_id" in cols
    assert "customer_id" in cols


def test_chat_room_user_property_delegates_to_customer():
    """room.user should return the same object as room.customer."""
    room = ChatRoom.__new__(ChatRoom)
    sentinel = object()
    room.customer = sentinel  # type: ignore[attr-defined]
    assert room.user is sentinel


def test_chat_room_user_id_property_delegates_to_customer_id():
    room = ChatRoom.__new__(ChatRoom)
    room.customer_id = 42  # type: ignore[attr-defined]
    assert room.user_id == 42


def test_chat_room_has_customer_relationship():
    rel_names = {r.key for r in sa_inspect(ChatRoom).mapper.relationships}
    assert "customer" in rel_names
    assert "store" in rel_names
    assert "messages" in rel_names
    assert "order_drafts" in rel_names


# ---------------------------------------------------------------------------
# ChatMessage – sticker columns present
# ---------------------------------------------------------------------------


def test_chat_message_tablename():
    assert ChatMessage.__tablename__ == "chat_message"


def test_chat_message_has_sticker_columns():
    cols = _column_names(ChatMessage)
    assert "sticker_package_id" in cols
    assert "sticker_id" in cols
    assert "line_msg_id" in cols
    assert "processed" in cols


# ---------------------------------------------------------------------------
# OrderDraft – pay_way + pay_status + customer_id (no user_id)
# ---------------------------------------------------------------------------


def test_order_draft_tablename():
    assert OrderDraft.__tablename__ == "order_draft"


def test_order_draft_has_pay_way_and_pay_status():
    cols = _column_names(OrderDraft)
    assert "pay_way" in cols
    assert "pay_status" in cols


def test_order_draft_has_customer_id_not_user_id():
    cols = _column_names(OrderDraft)
    assert "customer_id" in cols
    assert "user_id" not in cols


def test_order_draft_no_card_message_column():
    """card_message was removed in this PR."""
    cols = _column_names(OrderDraft)
    assert "card_message" not in cols


def test_order_draft_no_receipt_address_column():
    cols = _column_names(OrderDraft)
    assert "receipt_address" not in cols


def test_order_draft_no_shipment_status_column():
    """shipment_status was removed; only shipment_method remains."""
    cols = _column_names(OrderDraft)
    assert "shipment_status" not in cols
    assert "shipment_method" in cols


# ---------------------------------------------------------------------------
# Order – customer_name, customer_phone, pay_way, pay_status added
# ---------------------------------------------------------------------------


def test_order_tablename():
    assert Order.__tablename__ == "order"


def test_order_has_customer_snapshot_columns():
    cols = _column_names(Order)
    assert "customer_name" in cols
    assert "customer_phone" in cols


def test_order_has_pay_way_and_pay_status():
    cols = _column_names(Order)
    assert "pay_way" in cols
    assert "pay_status" in cols


def test_order_has_customer_id_not_user_id():
    cols = _column_names(Order)
    assert "customer_id" in cols
    assert "user_id" not in cols


def test_order_no_card_message_column():
    cols = _column_names(Order)
    assert "card_message" not in cols


def test_order_no_receipt_address_column():
    cols = _column_names(Order)
    assert "receipt_address" not in cols


def test_order_has_customer_relationship():
    rel_names = {r.key for r in sa_inspect(Order).mapper.relationships}
    assert "customer" in rel_names
    assert "payments" in rel_names


# ---------------------------------------------------------------------------
# StoreOrderFieldConfig (new model)
# ---------------------------------------------------------------------------


def test_store_order_field_config_tablename():
    assert StoreOrderFieldConfig.__tablename__ == "store_order_field_config"


def test_store_order_field_config_has_required_columns():
    cols = _column_names(StoreOrderFieldConfig)
    for c in ("id", "store_id", "visible_fields", "organize_required_fields", "created_at", "updated_at"):
        assert c in cols, f"Missing: {c}"


def test_store_order_field_config_has_store_relationship():
    rel_names = {r.key for r in sa_inspect(StoreOrderFieldConfig).mapper.relationships}
    assert "store" in rel_names


# ---------------------------------------------------------------------------
# PaymentMethod – store_id added
# ---------------------------------------------------------------------------


def test_payment_method_tablename():
    assert PaymentMethod.__tablename__ == "payment_method"


def test_payment_method_has_store_id():
    cols = _column_names(PaymentMethod)
    assert "store_id" in cols


def test_payment_method_has_store_relationship():
    rel_names = {r.key for r in sa_inspect(PaymentMethod).mapper.relationships}
    assert "store" in rel_names
    assert "payments" in rel_names


# ---------------------------------------------------------------------------
# Payment – relationships updated
# ---------------------------------------------------------------------------


def test_payment_has_order_relationship():
    rel_names = {r.key for r in sa_inspect(Payment).mapper.relationships}
    assert "order" in rel_names
    assert "method" in rel_names


# ---------------------------------------------------------------------------
# Notification – receiver_customer_id (not receiver_id)
# ---------------------------------------------------------------------------


def test_notification_tablename():
    assert Notification.__tablename__ == "notification"


def test_notification_has_receiver_customer_id():
    cols = _column_names(Notification)
    assert "receiver_customer_id" in cols
    assert "receiver_id" not in cols
    assert "receiver_type" not in cols


# ---------------------------------------------------------------------------
# Store (new model)
# ---------------------------------------------------------------------------


def test_store_tablename():
    assert Store.__tablename__ == "store"


def test_store_has_expected_columns():
    cols = _column_names(Store)
    for c in ("id", "name", "slug", "timezone", "active", "owner_auth_user_id"):
        assert c in cols, f"Missing: {c}"


def test_store_has_relationships():
    rel_names = {r.key for r in sa_inspect(Store).mapper.relationships}
    assert "customers" in rel_names
    assert "chat_rooms" in rel_names
    assert "payment_methods" in rel_names
    assert "order_field_config" in rel_names