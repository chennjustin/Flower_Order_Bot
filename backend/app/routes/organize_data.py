# backend/app/routes/organize_data.py

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.auth import get_chat_room_for_store, get_current_store
from app.models.store import Store
from app.schemas.order import OrganizeOrderDraftOut
from app.services.organize_data import organize_data

api_router = APIRouter()


@api_router.patch("/organize_data/{room_id}", response_model=OrganizeOrderDraftOut)
async def organize_data_by_room_id(
    room_id: int,
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    await get_chat_room_for_store(db, room_id, store)
    return await organize_data(db, room_id)