"""Store listing and authenticated owner's store."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_store
from app.core.database import get_db
from app.models.store import Store
from app.repositories.store_repository import list_stores
from app.schemas.store import StoreListItem

api_router = APIRouter(tags=["Stores"])


@api_router.get("/stores/me", response_model=StoreListItem)
async def get_my_store(store: Store = Depends(get_current_store)) -> StoreListItem:
    """Return the store bound to the logged-in owner (OAuth 1:1)."""
    return StoreListItem(id=store.id, name=store.name, slug=store.slug)


@api_router.get("/stores", response_model=List[StoreListItem])
async def get_stores(db: AsyncSession = Depends(get_db)) -> List[StoreListItem]:
    rows = await list_stores(db)
    return [StoreListItem(id=s.id, name=s.name, slug=s.slug) for s in rows]
