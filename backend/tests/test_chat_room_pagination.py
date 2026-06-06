"""Paginated GET /chat_rooms response helpers."""

from __future__ import annotations

import pytest

from app.enums.chat import ChatRoomStage
from app.repositories.chat_repository import _apply_chat_room_filters
from app.models.chat import ChatRoom


def test_apply_chat_room_filters_stage_and_search() -> None:
    from sqlalchemy import func, select

    stmt = select(func.count()).select_from(ChatRoom)
    stmt = _apply_chat_room_filters(
        stmt,
        store_id=3,
        stage=ChatRoomStage.WELCOME,
        q="陳",
    )
    sql = str(stmt)
    assert "store_id" in sql
    assert "stage" in sql
    assert "customer.name" in sql or "customer" in sql


@pytest.mark.asyncio
async def test_get_chat_room_page_has_more(monkeypatch) -> None:
    from app.services import message_service

    class FakeRoom:
        id = 10
        unread_count = 2
        stage = ChatRoomStage.WELCOME

        @property
        def user(self):
            class U:
                name = "測試"
                avatar_url = None

            return U()

    async def fake_count(_db, _store_id, *, stage=None, q=None):
        return 35

    async def fake_list(_db, _store_id, *, limit, offset, stage=None, q=None):
        return [FakeRoom()]

    async def fake_unread(_db, _store_id):
        return 5

    async def fake_filtered_unread(_db, _store_id, *, stage=None, q=None):
        return 1

    async def fake_build(_db, rooms):
        from app.schemas.chat import ChatRoomOut

        return [
            ChatRoomOut(
                room_id=rooms[0].id,
                user_name="測試",
                unread_count=2,
                status=ChatRoomStage.WELCOME,
                last_message=None,
            )
        ]

    monkeypatch.setattr(message_service, "count_chat_rooms_filtered", fake_count)
    monkeypatch.setattr(message_service, "list_chat_rooms_paginated", fake_list)
    monkeypatch.setattr(message_service, "sum_store_unread_count", fake_unread)
    monkeypatch.setattr(message_service, "count_filtered_unread_rooms", fake_filtered_unread)
    monkeypatch.setattr(message_service, "_build_chat_room_outs", fake_build)

    page = await message_service.get_chat_room_page(
        None,
        1,
        limit=30,
        offset=0,
    )
    assert page.total == 35
    assert page.total_unread == 5
    assert page.filtered_unread_rooms == 1
    assert page.has_more is True
    assert len(page.items) == 1
