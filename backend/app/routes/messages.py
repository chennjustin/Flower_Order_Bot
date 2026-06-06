import json
from datetime import datetime
from typing import AsyncIterator, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.auth import get_chat_room_for_store, get_current_store, get_current_store_sse
from app.core.deps import get_settings
from app.core.redis_client import is_redis_enabled
from app.models.store import Store
from app.enums.chat import ChatRoomStage
from app.schemas.chat import (
    ChatMessageCreate,
    ChatMessageOut,
    ChatRoomListOut,
    ChatRoomOut,
    StaffChatImageUploadOut,
    SwitchModeBody,
)
from app.services.chat_event_bus import subscribe_room_events, subscribe_rooms_events
from app.services.message_service import (
    create_staff_message,
    get_chat_messages,
    get_chat_room_by_room_id,
    get_chat_room_page,
    mark_room_as_read,
    switch_chat_room_mode,
)
from app.utils.staff_chat_upload import save_staff_chat_image

_MAX_CHAT_IMAGE_BYTES = 5 * 1024 * 1024
_ALLOWED_IMAGE_CT = frozenset({"image/jpeg", "image/png", "image/gif", "image/webp"})

api_router = APIRouter(prefix="/chat_rooms", tags=["Chat"])

_SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


async def _redis_sse_generator(
    event_source: AsyncIterator[str],
    *,
    store_id: int | None = None,
) -> AsyncIterator[str]:
    if not is_redis_enabled():
        yield "event: error\ndata: redis_disabled\n\n"
        return
    async for raw in event_source:
        if not raw:
            yield ": heartbeat\n\n"
            continue
        if store_id is not None:
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                continue
            if payload.get("store_id") != store_id:
                continue
        yield f"data: {raw}\n\n"


@api_router.get("/stream")
async def stream_all_chat_rooms(
    store: Store = Depends(get_current_store_sse),
):
    """SSE bridge: Redis pub/sub → browser (store-scoped list updates)."""
    return StreamingResponse(
        _redis_sse_generator(subscribe_rooms_events(), store_id=store.id),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@api_router.get("/{room_id}/stream")
async def stream_chat_room(
    room_id: int,
    store: Store = Depends(get_current_store_sse),
    db: AsyncSession = Depends(get_db),
):
    """SSE bridge: Redis pub/sub → browser (single room messages)."""
    await get_chat_room_for_store(db, room_id, store)
    return StreamingResponse(
        _redis_sse_generator(subscribe_room_events(room_id)),
        media_type="text/event-stream",
        headers=_SSE_HEADERS,
    )


@api_router.get("", response_model=ChatRoomListOut)
async def list_chat_rooms(
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    stage: Optional[ChatRoomStage] = None,
    q: Optional[str] = None,
):
    return await get_chat_room_page(
        db,
        store.id,
        limit=limit,
        offset=offset,
        stage=stage,
        q=q,
    )


@api_router.get("/{room_id}/messages", response_model=List[ChatMessageOut])
async def get_messages(
    room_id: int,
    after: Optional[datetime] = None,
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    await get_chat_room_for_store(db, room_id, store)
    return await get_chat_messages(db, room_id, after=after)


@api_router.post("/{room_id}/mark_read", response_model=dict)
async def mark_read(
    room_id: int,
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    await get_chat_room_for_store(db, room_id, store)
    cleared = await mark_room_as_read(db, room_id)
    return {"message": "success", "cleared_unread": cleared}


@api_router.post("/{room_id}/messages/upload_image", response_model=StaffChatImageUploadOut)
async def upload_staff_chat_image(
    room_id: int,
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
    file: UploadFile = File(...),
):
    """本機選圖上傳：存檔後回傳絕對 URL（須設定可被 LINE 存取的 PUBLIC_BASE_URL，例如 ngrok HTTPS）。"""
    room = await get_chat_room_for_store(db, room_id, store)

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
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    await get_chat_room_for_store(db, room_id, store)
    return await create_staff_message(db, room_id, message)


@api_router.post("/{room_id}/switch_mode", response_model=dict)
async def switch_mode(
    room_id: int,
    body: SwitchModeBody,
    store: Store = Depends(get_current_store),
    db: AsyncSession = Depends(get_db),
):
    await get_chat_room_for_store(db, room_id, store)
    await switch_chat_room_mode(db, room_id, body.stage)
    return {"message": "success"}