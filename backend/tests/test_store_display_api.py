import httpx
import pytest


@pytest.mark.asyncio
async def test_get_store_display_fields(monkeypatch):
    from app.main import app
    import app.routes.store_display as store_display_route

    async def fake_get_or_init_store_display_fields(_db, store_key: str):
        assert store_key == "demo-store"
        return {
            "store_key": "demo-store",
            "visible_fields": ["customer_name", "item", "quantity"],
            "updated_by_staff_id": 1,
            "updated_at": "2026-05-02T20:00:00",
        }

    monkeypatch.setattr(
        store_display_route, "get_or_init_store_display_fields", fake_get_or_init_store_display_fields
    )

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/stores/demo-store/display-fields")

    assert response.status_code == 200
    data = response.json()
    assert data["store_key"] == "demo-store"
    assert data["visible_fields"] == ["customer_name", "item", "quantity"]


@pytest.mark.asyncio
async def test_put_store_display_fields(monkeypatch):
    from app.main import app
    import app.routes.store_display as store_display_route

    async def fake_update_store_display_fields(
        db, store_key: str, visible_fields: list[str], updated_by_staff_id
    ):
        assert db is not None
        assert store_key == "demo-store"
        assert visible_fields == ["customer_name", "total_amount"]
        assert updated_by_staff_id == 99
        return {
            "store_key": "demo-store",
            "visible_fields": visible_fields,
            "updated_by_staff_id": updated_by_staff_id,
            "updated_at": "2026-05-02T20:01:00",
        }

    monkeypatch.setattr(store_display_route, "update_store_display_fields", fake_update_store_display_fields)

    payload = {"visible_fields": ["customer_name", "total_amount"], "updated_by_staff_id": 99}

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.put("/stores/demo-store/display-fields", json=payload)

    assert response.status_code == 200
    data = response.json()
    assert data["store_key"] == "demo-store"
    assert data["visible_fields"] == ["customer_name", "total_amount"]
    assert data["updated_by_staff_id"] == 99


@pytest.mark.asyncio
async def test_get_visible_order_draft_payload(monkeypatch):
    from app.main import app
    import app.routes.store_display as store_display_route

    async def fake_get_visible_order_draft_payload(_db, store_key: str, room_id: int):
        assert store_key == "demo-store"
        assert room_id == 7
        return {
            "store_key": store_key,
            "visible_fields": ["customer_name", "item", "quantity"],
            "payload": {
                "customer_name": "王小明",
                "item": "客製化花束",
                "quantity": 2,
            },
        }

    monkeypatch.setattr(
        store_display_route, "get_visible_order_draft_payload", fake_get_visible_order_draft_payload
    )

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/stores/demo-store/orderdraft/7/visible")

    assert response.status_code == 200
    data = response.json()
    assert data["store_key"] == "demo-store"
    assert data["visible_fields"] == ["customer_name", "item", "quantity"]
    assert data["payload"]["quantity"] == 2

