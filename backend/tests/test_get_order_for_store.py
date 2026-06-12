"""Tests for get_order_for_store (direct vs chat-originated orders)."""

from __future__ import annotations

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app.core.auth import get_order_for_store


class FakeSession:
    pass


def _store(store_id: int = 1) -> SimpleNamespace:
    return SimpleNamespace(id=store_id)


def _order(
    *,
    order_id: int = 1,
    room_id: int | None = None,
    store_id: int | None = None,
) -> SimpleNamespace:
    return SimpleNamespace(id=order_id, room_id=room_id, store_id=store_id)


@pytest.mark.asyncio
async def test_get_order_for_store_direct_order_matching_store(monkeypatch) -> None:
    order = _order(room_id=None, store_id=1)

    async def fake_get_order_by_id(_db, _order_id):
        return order

    monkeypatch.setattr(
        "app.repositories.order_repository.get_order_by_id",
        fake_get_order_by_id,
    )

    result = await get_order_for_store(FakeSession(), order_id=1, store=_store(1))
    assert result is order


@pytest.mark.asyncio
async def test_get_order_for_store_direct_order_wrong_store(monkeypatch) -> None:
    order = _order(room_id=None, store_id=2)

    async def fake_get_order_by_id(_db, _order_id):
        return order

    monkeypatch.setattr(
        "app.repositories.order_repository.get_order_by_id",
        fake_get_order_by_id,
    )

    with pytest.raises(HTTPException) as exc:
        await get_order_for_store(FakeSession(), order_id=1, store=_store(1))

    assert exc.value.status_code == 403
    assert "does not belong" in exc.value.detail


@pytest.mark.asyncio
async def test_get_order_for_store_chat_order_matching_store(monkeypatch) -> None:
    order = _order(room_id=10, store_id=None)
    room = SimpleNamespace(id=10, store_id=1)

    async def fake_get_order_by_id(_db, _order_id):
        return order

    async def fake_get_chat_room_by_room_id(_db, _room_id):
        return room

    monkeypatch.setattr(
        "app.repositories.order_repository.get_order_by_id",
        fake_get_order_by_id,
    )
    monkeypatch.setattr(
        "app.services.message_service.get_chat_room_by_room_id",
        fake_get_chat_room_by_room_id,
    )

    result = await get_order_for_store(FakeSession(), order_id=1, store=_store(1))
    assert result is order


@pytest.mark.asyncio
async def test_get_order_for_store_chat_order_wrong_store(monkeypatch) -> None:
    order = _order(room_id=10, store_id=None)
    room = SimpleNamespace(id=10, store_id=2)

    async def fake_get_order_by_id(_db, _order_id):
        return order

    async def fake_get_chat_room_by_room_id(_db, _room_id):
        return room

    monkeypatch.setattr(
        "app.repositories.order_repository.get_order_by_id",
        fake_get_order_by_id,
    )
    monkeypatch.setattr(
        "app.services.message_service.get_chat_room_by_room_id",
        fake_get_chat_room_by_room_id,
    )

    with pytest.raises(HTTPException) as exc:
        await get_order_for_store(FakeSession(), order_id=1, store=_store(1))

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_get_order_for_store_chat_order_missing_room(monkeypatch) -> None:
    order = _order(room_id=10, store_id=None)

    async def fake_get_order_by_id(_db, _order_id):
        return order

    async def fake_get_chat_room_by_room_id(_db, _room_id):
        return None

    monkeypatch.setattr(
        "app.repositories.order_repository.get_order_by_id",
        fake_get_order_by_id,
    )
    monkeypatch.setattr(
        "app.services.message_service.get_chat_room_by_room_id",
        fake_get_chat_room_by_room_id,
    )

    with pytest.raises(HTTPException) as exc:
        await get_order_for_store(FakeSession(), order_id=1, store=_store(1))

    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_get_order_for_store_not_found(monkeypatch) -> None:
    async def fake_get_order_by_id(_db, _order_id):
        return None

    monkeypatch.setattr(
        "app.repositories.order_repository.get_order_by_id",
        fake_get_order_by_id,
    )

    with pytest.raises(HTTPException) as exc:
        await get_order_for_store(FakeSession(), order_id=999, store=_store(1))

    assert exc.value.status_code == 404
