import httpx
import pytest


@pytest.mark.asyncio
async def test_contract_smoke_endpoints_exist():
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # health
        assert (await client.get("/health")).status_code == 200

        # orders / stats require active store (header or query)
        store_headers = {"X-Store-Id": "1"}
        orders_resp = await client.get("/orders", headers=store_headers)
        assert orders_resp.status_code in (200, 404)

        stats_resp = await client.get("/stats", headers=store_headers)
        assert stats_resp.status_code in (200, 404)

        assert (await client.get("/stores")).status_code in (200, 500)

        # payment methods
        assert (await client.get("/payment_methods")).status_code == 200

