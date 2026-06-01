import httpx
import pytest


@pytest.mark.asyncio
async def test_contract_smoke_endpoints_exist():
    from app.main import app

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        # health
        assert (await client.get("/health")).status_code == 200

        # orders list (may be empty; just ensure route exists)
        assert (await client.get("/orders")).status_code == 200

        # stats
        assert (await client.get("/stats")).status_code == 200

        # payment methods
        assert (await client.get("/payment_methods")).status_code == 200

