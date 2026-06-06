"""Store list for staff store picker (no X-Store-Id required)."""

from __future__ import annotations

from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repositories.store_repository import list_stores
from app.schemas.store import StoreListItem

api_router = APIRouter(tags=["Stores"])


@api_router.get("/stores", response_model=List[StoreListItem])
async def get_stores(db: AsyncSession = Depends(get_db)) -> List[StoreListItem]:
    rows = await list_stores(db)
    return [StoreListItem(id=s.id, name=s.name, slug=s.slug) for s in rows]
