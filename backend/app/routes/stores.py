"""Store listing and authenticated owner's store."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_store
from app.core.database import get_db
from app.core.time import now_taipei_naive
from app.models.store import Store
from app.repositories.store_repository import list_stores
from app.schemas.store import (
    LineOfficialDisplay,
    StoreListItem,
    StoreOnboardingContext,
    StoreOwnerDisplayNameResponse,
    StoreOwnerDisplayNameUpdateRequest,
)
from app.utils.line_bot_info import fetch_line_bot_profile

api_router = APIRouter(tags=["Stores"])


async def _resolve_line_official_display(store: Store) -> LineOfficialDisplay:
    token = (store.line_channel_access_token or "").strip()
    if token:
        try:
            profile = await fetch_line_bot_profile(token)
            return LineOfficialDisplay(
                display_name=profile["display_name"] or store.name,
                basic_id=profile["basic_id"],
                user_id=profile["user_id"] or store.slug,
                image_url=profile["picture_url"],
            )
        except ValueError:
            pass

    return LineOfficialDisplay(
        display_name=store.name,
        basic_id=None,
        user_id=store.slug,
        image_url=None,
    )


@api_router.get("/stores/me", response_model=StoreListItem)
async def get_my_store(store: Store = Depends(get_current_store)) -> StoreListItem:
    """Return the store bound to the logged-in owner (OAuth 1:1)."""
    return StoreListItem(id=store.id, name=store.name, slug=store.slug)


@api_router.get("/stores/me/onboarding-context", response_model=StoreOnboardingContext)
async def get_my_store_onboarding_context(
    store: Store = Depends(get_current_store),
) -> StoreOnboardingContext:
    """Return onboarding display context for the logged-in owner."""
    return StoreOnboardingContext(
        id=store.id,
        name=store.name,
        slug=store.slug,
        owner_display_name=store.owner_display_name,
        line_official=await _resolve_line_official_display(store),
    )


@api_router.patch(
    "/stores/me/owner-display-name",
    response_model=StoreOwnerDisplayNameResponse,
)
async def update_my_owner_display_name(
    payload: StoreOwnerDisplayNameUpdateRequest,
    db: AsyncSession = Depends(get_db),
    store: Store = Depends(get_current_store),
) -> StoreOwnerDisplayNameResponse:
    display_name = payload.owner_display_name.strip()
    if not display_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="owner_display_name cannot be empty",
        )
    store.owner_display_name = display_name
    store.updated_at = now_taipei_naive()
    await db.commit()
    await db.refresh(store)
    return StoreOwnerDisplayNameResponse(owner_display_name=store.owner_display_name or "")


@api_router.get("/stores", response_model=List[StoreListItem])
async def get_stores(db: AsyncSession = Depends(get_db)) -> List[StoreListItem]:
    rows = await list_stores(db)
    return [StoreListItem(id=s.id, name=s.name, slug=s.slug) for s in rows]
