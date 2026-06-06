from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException, status

from app.models.chat import ChatMessage, ChatRoom
from app.schemas.chat import (
    ChatRoomListOut,
    ChatRoomOut,
    ChatMessageOut,
    ChatMessagePayload,
    ChatMessageCreate,
)
from app.enums.chat import ChatMessageDirection, ChatMessageStatus
from app.core.line_client import line_bot_api_for_store
from app.repositories.store_repository import get_store_by_id
from app.utils.line_send_message import LINE_push_message
from app.services.user_service import get_user_by_id
from app.enums.chat import ChatRoomStage
from app.repositories.chat_repository import (
    count_filtered_unread_rooms,
    count_chat_rooms_filtered,
    create_chat_message_entry as repo_create_chat_message_entry,
    create_chat_room as repo_create_chat_room,
    get_chat_room_by_id as repo_get_chat_room_by_id,
    get_chat_room_by_user_id as repo_get_chat_room_by_user_id,
    get_latest_chat_message,
    get_latest_messages_for_room_ids,
    list_chat_messages,
    list_chat_rooms,
    list_chat_rooms_paginated,
    mark_chat_room_as_read,
    sum_store_unread_count,
    switch_chat_room_mode as repo_switch_chat_room_mode,
    touch_chat_room_updated_at,
)


def _payload_from_chat_row(message: ChatMessage) -> ChatMessagePayload:
    return ChatMessagePayload(
        text=message.text or None,
        image_url=message.image_url or None,
        sticker_package_id=message.sticker_package_id,
        sticker_id=message.sticker_id,
    )

async def get_latest_message(db: AsyncSession, room_id: int) -> Optional[ChatMessageOut]:
    message = await get_latest_chat_message(db, room_id)
    
    if not message:
        return None
    message = ChatMessageOut(
        id=message.id,
        direction=message.direction,
        user_avatar_url=None,
        message=_payload_from_chat_row(message),
        status=message.status,
        created_at=message.created_at
    )
    return message

def _chat_room_to_out(room: ChatRoom, last_msg: Optional[ChatMessageOut]) -> ChatRoomOut:
    return ChatRoomOut(
        room_id=room.id,
        user_name=room.user.name if room.user else "未知",
        user_avatar_url=room.user.avatar_url if room.user else None,
        unread_count=room.unread_count,
        status=room.stage,
        last_message={
            "text": last_msg.message.text or "",
            "timestamp": last_msg.created_at,
        }
        if last_msg
        else None,
    )


async def _build_chat_room_outs(
    db: AsyncSession, rooms: list[ChatRoom]
) -> list[ChatRoomOut]:
    if not rooms:
        return []
    latest_map = await get_latest_messages_for_room_ids(db, [room.id for room in rooms])
    response: list[ChatRoomOut] = []
    for room in rooms:
        message = latest_map.get(room.id)
        last_msg = None
        if message:
            last_msg = ChatMessageOut(
                id=message.id,
                direction=message.direction,
                user_avatar_url=None,
                message=_payload_from_chat_row(message),
                status=message.status,
                created_at=message.created_at,
            )
        response.append(_chat_room_to_out(room, last_msg))
    return response


async def get_chat_room_page(
    db: AsyncSession,
    store_id: int,
    *,
    limit: int = 30,
    offset: int = 0,
    stage: Optional[ChatRoomStage] = None,
    q: Optional[str] = None,
) -> ChatRoomListOut:
    limit = max(1, min(limit, 100))
    offset = max(0, offset)
    total = await count_chat_rooms_filtered(db, store_id, stage=stage, q=q)
    rooms = await list_chat_rooms_paginated(
        db,
        store_id,
        limit=limit,
        offset=offset,
        stage=stage,
        q=q,
    )
    items = await _build_chat_room_outs(db, rooms)
    total_unread = await sum_store_unread_count(db, store_id)
    filtered_unread_rooms = await count_filtered_unread_rooms(
        db,
        store_id,
        stage=stage,
        q=q,
    )
    return ChatRoomListOut(
        items=items,
        total=total,
        total_unread=total_unread,
        filtered_unread_rooms=filtered_unread_rooms,
        has_more=offset + len(items) < total,
    )


async def get_chat_room_list(
    db: AsyncSession, store_id: int | None = None
) -> Optional[List[ChatRoomOut]]:
    if store_id is None:
        rooms = await list_chat_rooms(db, store_id=None)
        return await _build_chat_room_outs(db, rooms)
    page = await get_chat_room_page(db, store_id, limit=10_000, offset=0)
    return page.items

async def get_chat_room_by_room_id(db: AsyncSession, room_id: int) -> Optional[ChatRoom]:
    return await repo_get_chat_room_by_id(db, room_id)

async def get_chat_room_by_user_id(db: AsyncSession, user_id: int) -> Optional[ChatRoom]:
    return await repo_get_chat_room_by_user_id(db, user_id)

async def create_chat_room(db: AsyncSession, user_id: int) -> ChatRoom:
    return await repo_create_chat_room(db, user_id)

async def get_chat_messages(db: AsyncSession, room_id: int, after: Optional[datetime] = None) -> List[ChatMessageOut]:
    chatroom = await get_chat_room_by_room_id(db, room_id)
    if not chatroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat room not found"
        )

    messages = await list_chat_messages(db, room_id, after=after)

    user = await get_user_by_id(db, chatroom.customer_id)
    if user:
        user_avatar_url = user.avatar_url
    else:
        user_avatar_url = None

    return [
        ChatMessageOut(
            id=message.id,
            direction=message.direction,
            user_avatar_url=user_avatar_url,
            message=_payload_from_chat_row(message),
            status=message.status,
            created_at=message.created_at
        ) for message in messages
    ]


async def mark_room_as_read(db: AsyncSession, room_id: int) -> int:
    room = await get_chat_room_by_room_id(db, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat room not found")
    return await mark_chat_room_as_read(db, room)

async def switch_chat_room_mode(db: AsyncSession, room_id: int, mode: str) -> None:
    await repo_switch_chat_room_mode(db, room_id, mode)

async def create_chat_message_entry(
    db: AsyncSession,
    room_id: int,
    data: ChatMessagePayload,
    direction: ChatMessageDirection,
    message_status: ChatMessageStatus = ChatMessageStatus.SENT,
) -> ChatMessage:
    return await repo_create_chat_message_entry(
        db,
        room_id,
        data,
        direction,
        message_status=message_status,
    )


async def create_staff_message(
    db: AsyncSession, room_id: int, body: ChatMessageCreate
) -> ChatMessageOut:
    payload = ChatMessagePayload.model_validate(body.model_dump())
    room = await get_chat_room_by_room_id(db, room_id)
    if not room:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat room not found")

    if not room.customer or not room.customer.line_uid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Customer has no LINE UID; cannot push message",
        )
    store = await get_store_by_id(db, room.store_id)
    if not store:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Store not found")

    line_uid = room.customer.line_uid
    line_api = line_bot_api_for_store(store)
    push_ok = LINE_push_message(line_api, line_uid, payload)
    message_status = ChatMessageStatus.SENT if push_ok else ChatMessageStatus.FAILED

    message = await repo_create_chat_message_entry(
        db=db,
        room_id=room.id,
        data=payload,
        direction=ChatMessageDirection.OUTGOING_BY_STORE,
        message_status=message_status,
    )

    await touch_chat_room_updated_at(db, room)

    out = ChatMessageOut(
        id=message.id,
        direction=message.direction,
        user_avatar_url=None,
        message=_payload_from_chat_row(message),
        status=message.status,
        created_at=message.created_at,
    )

    from app.services.chat_event_bus import publish_chat_message_out

    await publish_chat_message_out(room_id, out)
    return out