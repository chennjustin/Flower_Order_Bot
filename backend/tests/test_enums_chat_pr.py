"""Tests for changes in app/enums/chat.py introduced in the multitenant PR.

Covers:
- OUTGOING_BY_STORE new enum value
- OUTGOING_BY_STAFF legacy value retained for backward compat
- normalize_chat_message_direction() normalisation function
"""
import pytest

from app.enums.chat import (
    ChatMessageDirection,
    normalize_chat_message_direction,
)


# ---------------------------------------------------------------------------
# ChatMessageDirection enum values
# ---------------------------------------------------------------------------


def test_outgoing_by_store_member_exists():
    assert ChatMessageDirection.OUTGOING_BY_STORE == "OUTGOING_BY_STORE"


def test_outgoing_by_staff_legacy_member_still_exists():
    """OUTGOING_BY_STAFF must stay in the enum for backward compat with old DB rows."""
    assert ChatMessageDirection.OUTGOING_BY_STAFF == "OUTGOING_BY_STAFF"


def test_incoming_member_unchanged():
    assert ChatMessageDirection.INCOMING == "INCOMING"


def test_outgoing_by_bot_member_unchanged():
    assert ChatMessageDirection.OUTGOING_BY_BOT == "OUTGOING_BY_BOT"


def test_all_expected_members_present():
    names = {m.name for m in ChatMessageDirection}
    assert names == {"INCOMING", "OUTGOING_BY_BOT", "OUTGOING_BY_STORE", "OUTGOING_BY_STAFF"}


# ---------------------------------------------------------------------------
# normalize_chat_message_direction
# ---------------------------------------------------------------------------


def test_normalize_outgoing_by_staff_returns_outgoing_by_store():
    result = normalize_chat_message_direction("OUTGOING_BY_STAFF")
    assert result is ChatMessageDirection.OUTGOING_BY_STORE


def test_normalize_outgoing_by_store_string_returns_enum():
    result = normalize_chat_message_direction("OUTGOING_BY_STORE")
    assert result is ChatMessageDirection.OUTGOING_BY_STORE


def test_normalize_incoming_string_returns_enum():
    result = normalize_chat_message_direction("INCOMING")
    assert result is ChatMessageDirection.INCOMING


def test_normalize_outgoing_by_bot_string_returns_enum():
    result = normalize_chat_message_direction("OUTGOING_BY_BOT")
    assert result is ChatMessageDirection.OUTGOING_BY_BOT


def test_normalize_already_enum_passthrough():
    value = ChatMessageDirection.OUTGOING_BY_STORE
    result = normalize_chat_message_direction(value)
    assert result is value


def test_normalize_enum_instance_not_converted_even_if_staff():
    """Passing the enum member directly should return it as-is (no double-mapping)."""
    value = ChatMessageDirection.OUTGOING_BY_STAFF
    result = normalize_chat_message_direction(value)
    assert result is ChatMessageDirection.OUTGOING_BY_STAFF


def test_normalize_invalid_string_raises_value_error():
    with pytest.raises(ValueError):
        normalize_chat_message_direction("UNKNOWN_DIRECTION")


def test_normalize_empty_string_raises_value_error():
    with pytest.raises(ValueError):
        normalize_chat_message_direction("")