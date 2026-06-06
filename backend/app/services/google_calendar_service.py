"""Sync confirmed orders to the store owner's Google Calendar.

The store owner connects their Google account once (see routes/google_calendar.py);
we keep an encrypted refresh token on the Store row and use it to create / update /
delete a calendar event per order whenever the order changes.

All Google calls are best-effort: a failure here is logged and swallowed so it can
never break the underlying order operation. `googleapiclient` is synchronous, so the
blocking work runs in a worker thread via ``asyncio.to_thread``.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import timedelta
from typing import NamedTuple

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_token
from app.core.settings import load_settings
from app.models.order import Order
from app.models.store import Store

logger = logging.getLogger(__name__)

# calendar.events: manage events we create. openid + userinfo.email: read the
# connected account's address for display. access_type=offline + prompt=consent
# (set in the OAuth flow) are what make Google return a refresh token.
CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events"
GOOGLE_CALENDAR_SCOPES = [
    CALENDAR_EVENTS_SCOPE,
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
]
TOKEN_URI = "https://oauth2.googleapis.com/token"

# How long a delivery/pickup event blocks on the calendar.
_EVENT_DURATION = timedelta(hours=1)


class _GoogleConn(NamedTuple):
    refresh_token: str
    client_id: str | None
    client_secret: str | None


def is_connected(store: Store) -> bool:
    return bool(store.google_calendar_refresh_token)


def _conn_params(store: Store) -> _GoogleConn:
    settings = load_settings()
    return _GoogleConn(
        refresh_token=decrypt_token(store.google_calendar_refresh_token),
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
    )


def _credentials(conn: _GoogleConn) -> Credentials:
    # token=None forces a refresh from refresh_token on first request.
    # IMPORTANT: do NOT pass scopes here. google-auth would then send a `scope`
    # param on the refresh-token grant; because our consent includes `openid`,
    # Google rejects that refresh with `invalid_scope: Bad Request`. Omitting
    # scopes makes the refresh return the originally-granted scopes, which is
    # exactly what we want.
    return Credentials(
        token=None,
        refresh_token=conn.refresh_token,
        token_uri=TOKEN_URI,
        client_id=conn.client_id,
        client_secret=conn.client_secret,
    )


def _event_body(order: Order, timezone: str) -> dict:
    start = order.delivery_datetime
    end = start + _EVENT_DURATION
    summary = f"🌸 訂單 #{order.id} {order.customer_name or ''}".strip()

    lines: list[str] = []
    if order.item_type:
        lines.append(f"品項：{order.item_type}")
    if order.quantity is not None:
        lines.append(f"數量：{order.quantity}")
    if order.total_amount is not None:
        lines.append(f"金額：{order.total_amount}")
    if order.customer_phone:
        lines.append(f"電話：{order.customer_phone}")
    if order.shipment_method is not None:
        lines.append(f"取貨方式：{order.shipment_method.value}")
    if order.delivery_address:
        lines.append(f"地址：{order.delivery_address}")
    if order.notes:
        lines.append(f"備註：{order.notes}")

    return {
        "summary": summary,
        "description": "\n".join(lines),
        "start": {"dateTime": start.isoformat(), "timeZone": timezone},
        "end": {"dateTime": end.isoformat(), "timeZone": timezone},
    }


# --- blocking helpers (run inside asyncio.to_thread) ------------------------

def _upsert_event_sync(conn: _GoogleConn, calendar_id: str, event_id: str | None, body: dict) -> dict:
    service = build("calendar", "v3", credentials=_credentials(conn), cache_discovery=False)
    if event_id:
        return service.events().update(calendarId=calendar_id, eventId=event_id, body=body).execute()
    return service.events().insert(calendarId=calendar_id, body=body).execute()


def _delete_event_sync(conn: _GoogleConn, calendar_id: str, event_id: str) -> None:
    service = build("calendar", "v3", credentials=_credentials(conn), cache_discovery=False)
    service.events().delete(calendarId=calendar_id, eventId=event_id).execute()


# --- public async API -------------------------------------------------------

async def sync_order_event(db: AsyncSession, store: Store, order: Order) -> None:
    """Create or update the calendar event for an order. No-op if disconnected or no date."""
    if not is_connected(store) or order.delivery_datetime is None:
        return
    body = _event_body(order, store.timezone or "Asia/Taipei")
    calendar_id = store.google_calendar_id or "primary"
    try:
        result = await asyncio.to_thread(
            _upsert_event_sync, _conn_params(store), calendar_id, order.google_calendar_event_id, body
        )
    except Exception:
        logger.exception("Google Calendar sync failed for order %s", order.id)
        return

    event_id = result.get("id")
    if event_id and event_id != order.google_calendar_event_id:
        order.google_calendar_event_id = event_id
        db.add(order)
        await db.commit()


async def delete_order_event(db: AsyncSession, store: Store, order: Order) -> None:
    """Remove an order's calendar event, if one was created."""
    event_id = order.google_calendar_event_id
    if not event_id or not is_connected(store):
        return
    calendar_id = store.google_calendar_id or "primary"
    try:
        await asyncio.to_thread(_delete_event_sync, _conn_params(store), calendar_id, event_id)
    except Exception:
        # Event may already be gone; clear our reference either way.
        logger.exception("Google Calendar delete failed for order %s", order.id)

    order.google_calendar_event_id = None
    db.add(order)
    await db.commit()


async def backfill_store_orders(db: AsyncSession, store: Store) -> dict:
    """Create events for the store's existing non-cancelled orders that have a
    delivery time but aren't on the calendar yet. Idempotent — already-synced
    orders (with a google_calendar_event_id) are skipped, so it's safe to re-run.
    """
    from app.repositories.order_repository import list_active_orders

    if not is_connected(store):
        return {"synced": 0, "total": 0}

    orders = await list_active_orders(db, store.id)
    synced = 0
    for order in orders:
        if order.delivery_datetime is None or order.google_calendar_event_id is not None:
            continue
        before = order.google_calendar_event_id
        await sync_order_event(db, store, order)
        if order.google_calendar_event_id and order.google_calendar_event_id != before:
            synced += 1
    return {"synced": synced, "total": len(orders)}
