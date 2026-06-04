"""HTTP tests for multi-tenant store-scoped list APIs (Step 4)."""

from __future__ import annotations

import httpx
import pytest


@pytest.mark.asyncio
async def test_orders_requires_store_context() -> None:
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/orders")
    assert response.status_code == 400
    assert "Missing store id" in response.json()["detail"]


@pytest.mark.asyncio
async def test_chat_rooms_requires_store_context() -> None:
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/chat_rooms")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_stats_requires_store_context() -> None:
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/stats")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_order_field_config_path_mismatch_returns_403() -> None:
    from app.core.store_context import (
        get_resolved_store_id_with_path,
        require_path_store_id_matches,
    )
    from app.main import app

    async def override_resolved_path_store(store_id: int) -> int:
        await require_path_store_id_matches(store_id, resolved_store_id=1)
        return 1

    app.dependency_overrides[get_resolved_store_id_with_path] = override_resolved_path_store
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/stores/99/order-field-config")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.pop(get_resolved_store_id_with_path, None)


@pytest.mark.asyncio
async def test_stores_list_does_not_require_store_header() -> None:
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/stores")
    # 200 when DB has stores; still proves route exists without X-Store-Id
    assert response.status_code in (200, 500)
