from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.store_display import (
    StoreDisplayFieldsOut,
    StoreDisplayFieldsUpdate,
    VisiblePayloadOut,
)
from app.services.store_display_service import (
    get_or_init_store_display_fields,
    get_visible_order_draft_payload,
    update_store_display_fields,
)

api_router = APIRouter(prefix="/stores", tags=["Store Display"])


@api_router.get("/{store_key}/display-fields", response_model=StoreDisplayFieldsOut)
async def get_display_fields(store_key: str, db: AsyncSession = Depends(get_db)):
    return await get_or_init_store_display_fields(db, store_key)


@api_router.put("/{store_key}/display-fields", response_model=StoreDisplayFieldsOut)
async def put_display_fields(
    store_key: str, body: StoreDisplayFieldsUpdate, db: AsyncSession = Depends(get_db)
):
    return await update_store_display_fields(
        db=db,
        store_key=store_key,
        visible_fields=body.visible_fields,
        updated_by_staff_id=body.updated_by_staff_id,
    )


@api_router.get("/{store_key}/orderdraft/{room_id}/visible", response_model=VisiblePayloadOut)
async def get_visible_order_draft(store_key: str, room_id: int, db: AsyncSession = Depends(get_db)):
    return await get_visible_order_draft_payload(db, store_key, room_id)

