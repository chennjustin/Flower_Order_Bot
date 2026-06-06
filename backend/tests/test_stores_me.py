"""HTTP tests for GET /stores/me (OAuth-bound store)."""

from __future__ import annotations

import httpx
import pytest
from types import SimpleNamespace


@pytest.mark.asyncio
async def test_stores_me_requires_auth() -> None:
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/stores/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_stores_me_returns_bound_store() -> None:
    from app.core.auth import get_current_store
    from app.main import app

    bound = SimpleNamespace(id=42, name="My Flower Shop", slug="Uabc123")

    async def override_current_store() -> SimpleNamespace:
        return bound

    app.dependency_overrides[get_current_store] = override_current_store
    try:
        transport = httpx.ASGITransport(app=app)
        async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get(
                "/stores/me",
                headers={"Authorization": "Bearer test-token"},
            )
        assert response.status_code == 200
        payload = response.json()
        assert payload == {"id": 42, "name": "My Flower Shop", "slug": "Uabc123"}
    finally:
        app.dependency_overrides.pop(get_current_store, None)
