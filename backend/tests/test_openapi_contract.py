import httpx
import pytest


@pytest.mark.asyncio
async def test_swagger_ui_is_available_on_root():
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/")
        assert response.status_code == 200
        assert "swagger-ui" in response.text.lower()


@pytest.mark.asyncio
async def test_openapi_contains_frozen_core_paths():
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/openapi.json")
        assert response.status_code == 200
        openapi = response.json()

    expected_paths = {
        "/health",
        "/callback",
        "/orders",
        "/order/{room_id}",
        "/order/{order_id}",
        "/orderdraft/{room_id}",
        "/organize_data/{room_id}",
        "/chat_rooms",
        "/chat_rooms/{room_id}/messages",
        "/chat_rooms/{room_id}/switch_mode",
        "/stats",
        "/payment_methods",
        "/payment_methods/{payment_method_id}",
        "/orders/{order_id}.docx",
        "/generate-fake-data",
    }

    available_paths = set(openapi.get("paths", {}).keys())
    missing_paths = expected_paths - available_paths
    assert not missing_paths, f"Missing frozen contract paths: {sorted(missing_paths)}"
