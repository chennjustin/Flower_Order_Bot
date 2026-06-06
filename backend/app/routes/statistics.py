from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.repositories.store_repository import get_first_store_id
from app.schemas.stats import StatsOut
from app.services.stats_service import get_stats

api_router = APIRouter(tags=["Statistics"])


@api_router.get("/stats", response_model=StatsOut)
async def stats_api(db: AsyncSession = Depends(get_db)):
    store_id = await get_first_store_id(db)
    if store_id is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No store configured. Create a store in Supabase first.",
        )
    return await get_stats(db, store_id)
