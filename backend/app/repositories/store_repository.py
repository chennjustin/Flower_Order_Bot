from __future__ import annotations

import json

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import Settings, load_settings
from app.models.store import Store


async def get_first_store_id(db: AsyncSession) -> int | None:
    result = await db.execute(select(Store.id).order_by(Store.id).limit(1))
    return result.scalar_one_or_none()


async def get_seed_store_id(db: AsyncSession) -> int | None:
    """Fake data default store: match env LINE credentials, else real slug from token, else smallest id."""
    settings = load_settings()

    secret = (settings.line_channel_secret or "").strip()
    if secret:
        result = await db.execute(
            select(Store.id).where(Store.line_channel_secret == secret).limit(1)
        )
        store_id = result.scalar_one_or_none()
        if store_id is not None:
            return store_id

    token = (settings.line_channel_access_token or "").strip()
    if token:
        result = await db.execute(
            select(Store.id).where(Store.line_channel_access_token == token).limit(1)
        )
        store_id = result.scalar_one_or_none()
        if store_id is not None:
            return store_id

        from app.utils.line_bot_info import fetch_line_bot_user_id

        try:
            slug = await fetch_line_bot_user_id(token)
            store = await get_store_by_slug(db, slug)
            if store is not None:
                return store.id
        except ValueError:
            pass

    return await get_first_store_id(db)


async def get_store_by_id(db: AsyncSession, store_id: int) -> Store | None:
    result = await db.execute(select(Store).where(Store.id == store_id))
    return result.scalar_one_or_none()


async def get_store_by_slug(db: AsyncSession, slug: str) -> Store | None:
    """Lookup by store.slug (= LINE webhook destination)."""
    key = (slug or "").strip()
    if not key:
        return None
    result = await db.execute(select(Store).where(Store.slug == key))
    return result.scalar_one_or_none()


def parse_webhook_destination(body_str: str) -> str:
    try:
        payload = json.loads(body_str)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid webhook JSON",
        ) from e
    destination = (payload.get("destination") or "").strip()
    if not destination:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing destination in webhook body",
        )
    return destination


async def resolve_store_for_webhook(db: AsyncSession, body_str: str) -> Store:
    """
    Map LINE destination -> store.slug.
    Dev fallback: if no row matches but env LINE_CHANNEL_SECRET verifies, use first store.
    """
    from app.core.line_client import store_has_line_config

    destination = parse_webhook_destination(body_str)
    store = await get_store_by_slug(db, destination)
    if store is not None:
        if not store.active:
            raise HTTPException(
                status_code=status.HTTP_503_FORBIDDEN,
                detail="Store is inactive",
            )
        settings = load_settings()
        has_env = bool((settings.line_channel_secret or "").strip())
        if not store_has_line_config(store) and not has_env:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Store LINE credentials not configured",
            )
        return store

    settings: Settings = load_settings()
    secret = (settings.line_channel_secret or "").strip()
    if secret:
        store_id = await get_first_store_id(db)
        if store_id is not None:
            fallback = await get_store_by_id(db, store_id)
            if fallback is not None:
                return fallback

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"No store for LINE destination: {destination}",
    )


async def upsert_store_from_provision(
    db: AsyncSession,
    *,
    name: str,
    owner_email: str,
    slug: str,
    line_channel_access_token: str,
    line_channel_secret: str,
    timezone: str = "Asia/Taipei",
    active: bool = True,
    reset_owner_binding: bool = False,
) -> tuple[Store, bool]:
    """
    Insert or update store by owner_email, else by slug.
    Returns (store, created).
    """
    email = owner_email.strip().lower()
    slug_key = slug.strip()

    result = await db.execute(select(Store).where(Store.owner_email == email))
    store = result.scalar_one_or_none()
    if store is None:
        result = await db.execute(select(Store).where(Store.slug == slug_key))
        store = result.scalar_one_or_none()

    if store is None:
        store = Store(
            name=name,
            owner_email=email,
            slug=slug_key,
            line_channel_access_token=line_channel_access_token,
            line_channel_secret=line_channel_secret,
            timezone=timezone,
            active=active,
            owner_auth_user_id=None,
        )
        db.add(store)
        await db.flush()
        return store, True

    store.name = name
    store.owner_email = email
    store.slug = slug_key
    store.line_channel_access_token = line_channel_access_token
    store.line_channel_secret = line_channel_secret
    store.timezone = timezone
    store.active = active
    if reset_owner_binding:
        store.owner_auth_user_id = None
    await db.flush()
    return store, False


