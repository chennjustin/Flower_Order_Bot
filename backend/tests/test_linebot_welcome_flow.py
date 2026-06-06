"""Regression tests for welcome entry behavior in LINE flows."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.enums.chat import ChatRoomStage
from app.usecases import linebot_flow


class FakeDb:
    """Minimal async DB stub used by linebot flow tests."""

    def __init__(self) -> None:
        self.commit = AsyncMock()
        self.refresh = AsyncMock()
        self.add = MagicMock()


def _follow_event(user_id: str = "U123") -> SimpleNamespace:
    return SimpleNamespace(source=SimpleNamespace(user_id=user_id), reply_token="token")


@pytest.mark.asyncio
async def test_enter_welcome_stage_forces_welcome_and_sends_greeting(monkeypatch) -> None:
    store = SimpleNamespace(id=1)
    room = SimpleNamespace(stage=ChatRoomStage.WAITING_OWNER, bot_step=3)
    db = FakeDb()
    event = _follow_event()

    called = {}

    async def fake_run_welcome_flow(chat_room, user_text, ev, _store, _db):
        called["chat_room"] = chat_room
        called["user_text"] = user_text
        called["event"] = ev

    monkeypatch.setattr(linebot_flow, "run_welcome_flow", fake_run_welcome_flow)

    await linebot_flow.enter_welcome_stage_and_send_greeting(room, event, store, db)

    assert room.stage == ChatRoomStage.WELCOME
    assert room.bot_step == -1
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(room)
    assert called["chat_room"] is room
    assert called["user_text"] == ""
    assert called["event"] is event


@pytest.mark.asyncio
async def test_run_welcome_flow_sends_preface_before_confirm(monkeypatch) -> None:
    store = SimpleNamespace(id=1)
    room = SimpleNamespace(id=501, stage=ChatRoomStage.WELCOME, bot_step=-1)
    event = _follow_event()
    db = FakeDb()
    called = {}

    def fake_send_confirm(_line_api, _reply_token, text, **kwargs):
        called["text"] = text
        called["kwargs"] = kwargs

    monkeypatch.setattr(linebot_flow, "line_bot_api_for_store", lambda _store: object())
    monkeypatch.setattr(linebot_flow, "send_confirm", fake_send_confirm)

    await linebot_flow.run_welcome_flow(room, "", event, store, db)

    assert called["text"] == "若想要訂購客製化花束，請按「是」~"
    assert called["kwargs"]["preface_text"] == "您好，歡迎來到奇美花店！"
    assert db.add.call_count == 2
    assert room.bot_step == 0


@pytest.mark.asyncio
async def test_run_bot_flow_invalid_step_in_welcome_recovers_to_welcome(monkeypatch) -> None:
    store = SimpleNamespace(id=1)
    room = SimpleNamespace(stage=ChatRoomStage.WELCOME, bot_step=999)
    event = _follow_event()
    db = FakeDb()

    recover = AsyncMock()
    monkeypatch.setattr(linebot_flow, "enter_welcome_stage_and_send_greeting", recover)
    monkeypatch.setattr(linebot_flow, "line_bot_api_for_store", lambda _store: object())

    await linebot_flow.run_bot_flow(room, "", event, store, db)

    recover.assert_awaited_once_with(room, event, store, db)
    assert room.stage == ChatRoomStage.WELCOME


@pytest.mark.asyncio
async def test_resolve_line_user_and_room_resets_to_welcome_after_7_days(monkeypatch) -> None:
    db = FakeDb()
    store = SimpleNamespace(id=11)
    user = SimpleNamespace(id=7, name="Known User", avatar_url="avatar")
    room = SimpleNamespace(id=42, stage=ChatRoomStage.WAITING_OWNER, bot_step=2)
    old_message = SimpleNamespace(
        created_at=(datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None) - timedelta(days=8))
    )

    monkeypatch.setattr(linebot_flow, "line_bot_api_for_store", lambda _store: object())
    monkeypatch.setattr(linebot_flow, "get_user_by_line_uid", AsyncMock(return_value=user))
    monkeypatch.setattr(linebot_flow, "get_chat_room_by_user_id", AsyncMock(return_value=room))
    monkeypatch.setattr(linebot_flow, "get_latest_message", AsyncMock(return_value=old_message))
    monkeypatch.setattr(linebot_flow, "get_order_draft_by_room", AsyncMock(return_value=object()))

    _, resolved_room = await linebot_flow.resolve_line_user_and_room(db, "Uabc", store)

    assert resolved_room is room
    assert room.stage == ChatRoomStage.WELCOME
    assert room.bot_step == -1
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(room)


@pytest.mark.asyncio
async def test_handle_follow_new_user_creates_room_and_triggers_welcome(monkeypatch) -> None:
    from app.routes import linebot as linebot_route

    db = FakeDb()
    store = SimpleNamespace(id=5)
    event = _follow_event("Unew")
    user = SimpleNamespace(id=101)
    room = SimpleNamespace(id=202, stage=ChatRoomStage.WELCOME, bot_step=-1)
    welcome = AsyncMock()

    monkeypatch.setattr(linebot_route, "get_user_by_line_uid", AsyncMock(return_value=None))
    monkeypatch.setattr(linebot_route, "create_user", AsyncMock(return_value=user))
    monkeypatch.setattr(linebot_route, "get_chat_room_by_user_id", AsyncMock(return_value=None))
    monkeypatch.setattr(linebot_route, "create_chat_room", AsyncMock(return_value=room))
    monkeypatch.setattr(linebot_route, "enter_welcome_stage_and_send_greeting", welcome)

    await linebot_route.handle_follow(event, store, db)

    welcome.assert_awaited_once_with(room, event, store, db)


@pytest.mark.asyncio
async def test_handle_follow_existing_room_still_triggers_welcome(monkeypatch) -> None:
    """Represents unblock-follow flow: existing room must re-enter welcome."""
    from app.routes import linebot as linebot_route

    db = FakeDb()
    store = SimpleNamespace(id=5)
    event = _follow_event("Uexisting")
    user = SimpleNamespace(id=99)
    room = SimpleNamespace(id=88, stage=ChatRoomStage.WAITING_OWNER, bot_step=0)
    welcome = AsyncMock()

    monkeypatch.setattr(linebot_route, "get_user_by_line_uid", AsyncMock(return_value=user))
    monkeypatch.setattr(linebot_route, "create_user", AsyncMock())
    monkeypatch.setattr(linebot_route, "get_chat_room_by_user_id", AsyncMock(return_value=room))
    monkeypatch.setattr(linebot_route, "create_chat_room", AsyncMock())
    monkeypatch.setattr(linebot_route, "enter_welcome_stage_and_send_greeting", welcome)

    await linebot_route.handle_follow(event, store, db)

    welcome.assert_awaited_once_with(room, event, store, db)
