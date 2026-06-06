from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.store_context import get_resolved_store_id
from app.schemas.stats import StatsOut
from app.services.stats_service import get_stats

api_router = APIRouter(tags=["Statistics"])


@api_router.get("/stats", response_model=StatsOut)
async def stats_api(
    db: AsyncSession = Depends(get_db),
    store_id: int = Depends(get_resolved_store_id),
):
    return await get_stats(db, store_id)
