"""Paginated GET /orders filters and response shape."""

from __future__ import annotations

from datetime import datetime

import pytest
from sqlalchemy import select

from app.enums.order import OrderStatus
from app.models.order import Order
from app.repositories.order_repository import OrderListFilters, _apply_order_list_filters


def test_apply_order_list_filters_in_progress_status() -> None:
    stmt = _apply_order_list_filters(
        select(Order),
        OrderListFilters(store_id=1, status="in_progress"),
    )
    sql = str(stmt)
    assert "store_id" in sql


def test_apply_order_list_filters_fulfilled_status() -> None:
    stmt = _apply_order_list_filters(
        select(Order),
        OrderListFilters(store_id=1, status="fulfilled"),
    )
    sql = str(stmt)
    assert "store_id" in sql
    assert "status" in sql


def test_apply_order_list_filters_include_cancelled() -> None:
    stmt = _apply_order_list_filters(
        select(Order),
        OrderListFilters(store_id=2, include_cancelled=True),
    )
    sql = str(stmt)
    assert "store_id" in sql


@pytest.mark.asyncio
async def test_get_orders_page_returns_list_shape(monkeypatch) -> None:
    from app.services import order_service
    from app.schemas.order import OrderOut

    fake_out = OrderOut(
        id=1,
        customer_name="測試",
        customer_phone="0912",
        order_date=datetime(2026, 6, 1, 10, 0),
        order_status=OrderStatus.CONFIRMED,
        pay_way="現金",
        pay_status=None,
        total_amount=100,
        item="花束",
        quantity=1,
        note=None,
        shipment_method=None,
        send_datetime=datetime(2026, 6, 6, 12, 0),
        delivery_address="",
    )

    async def fake_count(_db, _filters):
        return 1

    async def fake_list(_db, _filters, *, limit=None, offset=0):
        return [object()]

    async def fake_batch(_db, _orders):
        return [fake_out]

    monkeypatch.setattr(order_service, "count_orders_filtered", fake_count)
    monkeypatch.setattr(order_service, "list_orders_filtered", fake_list)
    monkeypatch.setattr(order_service, "_build_orders_out_batch", fake_batch)

    result = await order_service.get_orders_page(
        None,
        OrderListFilters(store_id=1),
        page=1,
        page_size=10,
    )
    assert result.total == 1
    assert result.page == 1
    assert result.page_size == 10
    assert len(result.items) == 1
