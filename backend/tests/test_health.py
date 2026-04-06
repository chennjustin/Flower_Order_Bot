import httpx
import pytest


@pytest.mark.asyncio
async def test_health_ok():
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        r = await client.get("/health")
        assert r.status_code == 200
        assert r.text == "OK"

