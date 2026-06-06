"""Google Calendar connect / callback / status / disconnect for store owners.

A store owner opts in by hitting ``/google/calendar/connect`` (authenticated),
which returns a Google consent URL. Google redirects the browser back to
``/google/calendar/callback`` (public — no bearer), where we exchange the code for
a refresh token, encrypt it onto the Store row, and bounce back to the frontend.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time

import jwt
import requests
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import RedirectResponse
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_store
from app.core.crypto import encrypt_token
from app.core.database import get_db
from app.core.settings import Settings, load_settings
from app.models.store import Store
from app.repositories.store_repository import get_store_by_id
from app.services.google_calendar_service import (
    CALENDAR_EVENTS_SCOPE,
    GOOGLE_CALENDAR_SCOPES,
    backfill_store_orders,
    is_connected,
)

# Google echoes scopes back in a different order (and adds `openid`); relax so
# oauthlib doesn't reject the token exchange over a scope mismatch.
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")

logger = logging.getLogger(__name__)

api_router = APIRouter(prefix="/google/calendar", tags=["Google Calendar"])

_STATE_TTL_SECONDS = 600  # OAuth round-trip must complete within 10 minutes.


class ConnectUrlOut(BaseModel):
    authorization_url: str


class CalendarStatusOut(BaseModel):
    connected: bool
    email: str | None = None


class BackfillResultOut(BaseModel):
    synced: int
    total: int


def _require_config(settings: Settings) -> None:
    if not (settings.google_client_id and settings.google_client_secret and settings.google_oauth_redirect_uri):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Calendar integration is not configured on the server.",
        )


def _build_flow(settings: Settings) -> Flow:
    client_config = {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.google_oauth_redirect_uri],
        }
    }
    return Flow.from_client_config(
        client_config,
        scopes=GOOGLE_CALENDAR_SCOPES,
        redirect_uri=settings.google_oauth_redirect_uri,
    )


def _encode_state(store_id: int, secret: str) -> str:
    payload = {"store_id": store_id, "exp": int(time.time()) + _STATE_TTL_SECONDS}
    return jwt.encode(payload, secret, algorithm="HS256")


def _decode_state(token: str, secret: str) -> int:
    payload = jwt.decode(token, secret, algorithms=["HS256"])
    return int(payload["store_id"])


def _exchange_code_sync(settings: Settings, code: str) -> tuple[str | None, str | None, set[str]]:
    """Blocking: swap auth code for tokens, return (refresh_token, email, granted_scopes)."""
    flow = _build_flow(settings)
    flow.fetch_token(code=code)
    creds = flow.credentials
    raw_scope = (flow.oauth2session.token or {}).get("scope", "")
    granted = set(raw_scope) if isinstance(raw_scope, (list, tuple)) else set(raw_scope.split())
    email: str | None = None
    try:
        oauth2 = build("oauth2", "v2", credentials=creds, cache_discovery=False)
        email = oauth2.userinfo().get().execute().get("email")
    except Exception:
        logger.exception("Failed to fetch Google userinfo email")
    return creds.refresh_token, email, granted


def _revoke_sync(refresh_token: str) -> None:
    try:
        requests.post(
            "https://oauth2.googleapis.com/revoke",
            params={"token": refresh_token},
            headers={"content-type": "application/x-www-form-urlencoded"},
            timeout=5.0,
        )
    except Exception:
        logger.exception("Failed to revoke Google token")


@api_router.get("/connect", response_model=ConnectUrlOut)
async def connect(store: Store = Depends(get_current_store)) -> ConnectUrlOut:
    settings = load_settings()
    _require_config(settings)
    flow = _build_flow(settings)
    state = _encode_state(store.id, settings.google_client_secret)
    authorization_url, _ = flow.authorization_url(
        access_type="offline",      # ask for a refresh token
        prompt="consent",           # force consent so the refresh token is returned
        include_granted_scopes="true",
        state=state,
    )
    return ConnectUrlOut(authorization_url=authorization_url)


@api_router.get("/callback")
async def callback(
    db: AsyncSession = Depends(get_db),
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
) -> RedirectResponse:
    settings = load_settings()
    redirect_ok = f"{settings.frontend_base_url}/settings/integrations?calendar=connected"
    redirect_err = f"{settings.frontend_base_url}/settings/integrations?calendar=error"

    if error or not code or not state:
        return RedirectResponse(url=redirect_err)

    try:
        store_id = _decode_state(state, settings.google_client_secret or "")
    except Exception:
        logger.exception("Invalid OAuth state")
        return RedirectResponse(url=redirect_err)

    store = await get_store_by_id(db, store_id)
    if store is None:
        return RedirectResponse(url=redirect_err)

    try:
        refresh_token, email, granted = await asyncio.to_thread(_exchange_code_sync, settings, code)
    except Exception:
        logger.exception("Google token exchange failed")
        return RedirectResponse(url=redirect_err)

    # The calendar scope must actually be granted, or every sync would 403 later.
    # This is usually missing because calendar.events isn't on the OAuth consent
    # screen's scope list, so Google drops it (only email/openid come through).
    if CALENDAR_EVENTS_SCOPE not in granted:
        logger.warning("Calendar connect missing calendar.events scope; granted=%s", granted)
        return RedirectResponse(
            url=f"{settings.frontend_base_url}/settings/integrations?calendar=missing_scope"
        )

    # Google only returns a refresh token on first/forced consent. If absent but the
    # store is already connected, keep the existing token.
    if refresh_token:
        store.google_calendar_refresh_token = encrypt_token(refresh_token)
    elif not is_connected(store):
        return RedirectResponse(url=redirect_err)

    if email:
        store.google_calendar_email = email
    if not store.google_calendar_id:
        store.google_calendar_id = "primary"
    db.add(store)
    await db.commit()
    return RedirectResponse(url=redirect_ok)


@api_router.get("/status", response_model=CalendarStatusOut)
async def get_status(store: Store = Depends(get_current_store)) -> CalendarStatusOut:
    return CalendarStatusOut(connected=is_connected(store), email=store.google_calendar_email)


@api_router.post("/sync-existing", response_model=BackfillResultOut)
async def sync_existing(
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
) -> BackfillResultOut:
    """Push the store's existing (non-cancelled, dated, not-yet-synced) orders to the calendar."""
    if not is_connected(store):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Calendar is not connected.",
        )
    result = await backfill_store_orders(db, store)
    return BackfillResultOut(**result)


@api_router.post("/disconnect", response_model=CalendarStatusOut)
async def disconnect(
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
) -> CalendarStatusOut:
    if store.google_calendar_refresh_token:
        from app.core.crypto import decrypt_token

        try:
            token = decrypt_token(store.google_calendar_refresh_token)
            await asyncio.to_thread(_revoke_sync, token)
        except Exception:
            logger.exception("Failed to decrypt/revoke Google token on disconnect")

    store.google_calendar_refresh_token = None
    store.google_calendar_email = None
    db.add(store)
    await db.commit()
    return CalendarStatusOut(connected=False, email=None)
