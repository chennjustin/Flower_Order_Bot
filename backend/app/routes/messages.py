from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_settings
from app.core.redis_client import is_redis_enabled
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessageOut,
    ChatRoomOut,
    StaffChatImageUploadOut,
    SwitchModeBody,
)
from app.services.chat_event_bus import subscribe_room_events, subscribe_rooms_events
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

api_router = APIRouter(prefix="/chat_rooms", tags=["Chat"])

@api_router.get("", response_model=List[ChatRoomOut])
async def list_chat_rooms(db: AsyncSession = Depends(get_db)):
    return await get_chat_room_list(db)


async def _sse_event_generator(event_source):
    if not is_redis_enabled():
        yield 'event: error\ndata: {"detail":"Redis not configured"}\n\n'
        return
    async for data in event_source:
        if not data:
            yield ": keepalive\n\n"
        else:
            yield f"data: {data}\n\n"


@api_router.get("/stream")
async def stream_chat_rooms():
    """SSE: Redis pub/sub for chat list updates (all rooms)."""
    return StreamingResponse(
        _sse_event_generator(subscribe_rooms_events()),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


@api_router.get("/{room_id}/stream")
async def stream_room_messages(room_id: int, db: AsyncSession = Depends(get_db)):
    """SSE: Redis pub/sub for new messages in one chat room."""
    room = await get_chat_room_by_room_id(db, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat room not found")
    return StreamingResponse(
        _sse_event_generator(subscribe_room_events(room_id)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
    )


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