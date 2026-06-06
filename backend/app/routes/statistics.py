from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_store
from app.core.database import get_db
from app.models.store import Store
from app.schemas.stats import StatsOut
from app.services.stats_service import get_stats

api_router = APIRouter(tags=["Statistics"])


@api_router.get("/stats", response_model=StatsOut)
async def stats_api(
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    return await get_stats(db, store.id)
