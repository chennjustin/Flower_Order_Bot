"""Tests for multi-tenant store id resolution (Step 3)."""

from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.core.store_context import (
    STORE_ID_HEADER,
    parse_store_id,
    require_path_store_id_matches,
    resolve_store_id,
)


def test_parse_store_id_prefers_header_over_query() -> None:
    assert parse_store_id(header_value="2", query_value=9) == 2


def test_parse_store_id_uses_query_when_header_missing() -> None:
    assert parse_store_id(header_value=None, query_value=5) == 5


def test_parse_store_id_returns_none_when_both_missing() -> None:
    assert parse_store_id(header_value=None, query_value=None) is None
    assert parse_store_id(header_value="  ", query_value=None) is None


def test_parse_store_id_rejects_invalid_header() -> None:
    with pytest.raises(HTTPException) as exc:
        parse_store_id(header_value="abc", query_value=None)
    assert exc.value.status_code == 400


def test_parse_store_id_rejects_non_positive_query() -> None:
    with pytest.raises(HTTPException) as exc:
        parse_store_id(header_value=None, query_value=0)
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_resolve_store_id_missing_returns_400() -> None:
    with pytest.raises(HTTPException) as exc:
        await resolve_store_id(db=None, header_value=None, query_value=None)
    assert exc.value.status_code == 400
    assert "Missing store id" in exc.value.detail


@pytest.mark.asyncio
async def test_resolve_store_id_store_not_found_returns_404(monkeypatch) -> None:
    async def fake_execute(_stmt):
        class Result:
            def scalar_one_or_none(self):
                return None

        return Result()

    class FakeSession:
        async def execute(self, stmt):
            return await fake_execute(stmt)

    with pytest.raises(HTTPException) as exc:
        await resolve_store_id(FakeSession(), header_value="1", query_value=None)
    assert exc.value.status_code == 404


@pytest.mark.asyncio
async def test_resolve_store_id_success(monkeypatch) -> None:
    async def fake_execute(_stmt):
        class Result:
            def scalar_one_or_none(self):
                return 3

        return Result()

    class FakeSession:
        async def execute(self, stmt):
            return await fake_execute(stmt)

    store_id = await resolve_store_id(FakeSession(), header_value=None, query_value=3)
    assert store_id == 3


@pytest.mark.asyncio
async def test_require_path_store_id_matches_blocks_mismatch() -> None:
    with pytest.raises(HTTPException) as exc:
        await require_path_store_id_matches(2, 5)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_require_path_store_id_matches_allows_match() -> None:
    await require_path_store_id_matches(4, 4)


def test_store_id_header_constant() -> None:
    assert STORE_ID_HEADER == "X-Store-Id"
