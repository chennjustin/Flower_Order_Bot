# backend/app/routes/chat.py

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, get_settings
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessageOut,
    ChatRoomOut,
    StaffChatImageUploadOut,
    SwitchModeBody,
)
from app.services.message_service import (
    create_staff_message,
    get_chat_messages,
    get_chat_room_by_room_id,
    get_chat_room_list,
    switch_chat_room_mode,
)
from app.utils.staff_chat_upload import save_staff_chat_image

_MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024
_ALLOWED_IMAGE_CT = frozenset({"image/jpeg", "image/png", "image/gif", "image/webp"})

api_router = APIRouter(prefix="/chat_rooms", tags=["Chat"], dependencies=[Depends(get_current_user)])

@api_router.get("", response_model=List[ChatRoomOut])
async def list_chat_rooms(db: AsyncSession = Depends(get_db)):
    return await get_chat_room_list(db)


@api_router.get("/{room_id}/messages", response_model=List[ChatMessageOut])
async def get_messages(
    room_id: int,
    after: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db)
):
    return await get_chat_messages(db, room_id, after=after)


@api_router.post("/{room_id}/messages/upload_image", response_model=StaffChatImageUploadOut)
async def upload_staff_chat_image(
    room_id: int,
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    """本機選圖上傳：存檔後回傳絕對 URL（須設定可被 LINE 存取的 PUBLIC_BASE_URL，例如 ngrok HTTPS）。"""
    room = await get_chat_room_by_room_id(db, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat room not found")

    ct = (file.content_type or "").split(";")[0].strip().lower()
    if ct not in _ALLOWED_IMAGE_CT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image/jpeg, image/png, image/gif, image/webp are allowed",
        )

    raw = await file.read()
    if len(raw) > _MAX_CHAT_IMAGE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Image too large (max {_MAX_CHAT_IMAGE_BYTES // (1024 * 1024)}MB)",
        )
    if len(raw) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")

    settings = get_settings()
    url = save_staff_chat_image(settings.public_base_url, raw, ct)
    return StaffChatImageUploadOut(image_url=url)


@api_router.post("/{room_id}/messages", response_model=ChatMessageOut)
async def post_message(
    room_id: int, 
    message: ChatMessageCreate, 
    db: AsyncSession = Depends(get_db)):
    return await create_staff_message(db, room_id, message)
    

@api_router.post("/{room_id}/switch_mode", response_model=dict)
async def switch_mode(
    room_id: int,
    body: SwitchModeBody,
    db: AsyncSession = Depends(get_db),
):
    await switch_chat_room_mode(db, room_id, body.stage)
    return {"message": "success"}