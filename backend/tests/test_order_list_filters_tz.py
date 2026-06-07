"""build_order_list_filters normalizes pickup bounds to Taipei-naive.

Regression for the calendar `/orders` 500: the frontend sends UTC ISO strings
(`...Z`) which FastAPI parses into timezone-aware datetimes, but
`Order.delivery_datetime` is a naive (TIMESTAMP WITHOUT TIME ZONE) column storing
Taipei wall time. asyncpg cannot compare naive column to aware param.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.services.order_service import build_order_list_filters


def test_aware_utc_pickup_bounds_are_converted_to_taipei_naive() -> None:
    pickup_from = datetime(2026, 5, 31, 16, 0, tzinfo=timezone.utc)
    pickup_to = datetime(2026, 6, 30, 16, 0, tzinfo=timezone.utc)

    filters = build_order_list_filters(
        store_id=5,
        pickup_from=pickup_from,
        pickup_to=pickup_to,
    )

    # UTC 16:00 == Taipei 00:00 next day (GMT+8), tzinfo dropped.
    assert filters.pickup_from == datetime(2026, 6, 1, 0, 0)
    assert filters.pickup_from.tzinfo is None
    assert filters.pickup_to == datetime(2026, 7, 1, 0, 0)
    assert filters.pickup_to.tzinfo is None


def test_naive_pickup_bounds_are_left_unchanged() -> None:
    pickup_from = datetime(2026, 6, 1, 0, 0)

    filters = build_order_list_filters(store_id=5, pickup_from=pickup_from)

    assert filters.pickup_from == pickup_from
    assert filters.pickup_from.tzinfo is None


def test_missing_pickup_bounds_stay_none() -> None:
    filters = build_order_list_filters(store_id=5)

    assert filters.pickup_from is None
    assert filters.pickup_to is None
