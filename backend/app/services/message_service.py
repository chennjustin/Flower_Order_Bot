from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime
from typing import List, Optional

from app.models.chat import ChatRoom, ChatMessage
from app.schemas.chat import ChatRoomOut, ChatMessageOut, ChatMessageBase
from app.enums.chat import ChatMessageDirection
from app.utils.line_send_message import LINE_push_message
from app.services.user_service import get_user_by_line_uid, get_user_by_id
from fastapi import HTTPException, status
from app.repositories.chat_repository import (
    create_chat_message_entry as repo_create_chat_message_entry,
    create_chat_room as repo_create_chat_room,
    get_chat_room_by_id as repo_get_chat_room_by_id,
    get_chat_room_by_user_id as repo_get_chat_room_by_user_id,
    get_latest_chat_message,
    list_chat_messages,
    list_chat_rooms,
    switch_chat_room_mode as repo_switch_chat_room_mode,
    touch_chat_room_updated_at,
)

async def get_latest_message(db: AsyncSession, room_id: int) -> Optional[ChatMessageOut]:
    message = await get_latest_chat_message(db, room_id)
    
    if not message:
        return None
    message = ChatMessageOut(
        id=message.id,
        direction=message.direction,
        user_avatar_url=None,
        message=ChatMessageBase(
            text=message.text,
            image_url=message.image_url
        ),
        status=message.status,
        created_at=message.created_at
    )
    return message

async def get_chat_room_list(db: AsyncSession) -> Optional[List[ChatRoomOut]]:
    rooms = await list_chat_rooms(db)

    response = []
    for room in rooms:
        last_msg = await get_latest_message(db, room.id)
        # 如果聊天室沒有訊息，則不顯示最後訊息
        response.append(ChatRoomOut(
            room_id=room.id,
            user_name=room.user.name if room.user else "未知",
            user_avatar_url=room.user.avatar_url if room.user else None,
            unread_count=room.unread_count,
            status=room.stage,
            last_message={
                "text": last_msg.message.text,
                "timestamp": last_msg.created_at,
            } if last_msg else None,
        ))

    # 以 last_message 的 time stamp 排序
    response.sort(key=lambda x: x.last_message.timestamp if x.last_message else datetime.min, reverse=True)

    return response

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
    
    chatroom = await get_chat_room_by_room_id(db, room_id)
    if not chatroom:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat room not found"
        )
    
    messages = await list_chat_messages(db, room_id, after=after)

    user = await get_user_by_id(db, chatroom.user_id)
    if user:
        user_avatar_url = user.avatar_url
    else:
        user_avatar_url = None

    return [
        ChatMessageOut(
            id=message.id,
            direction=message.direction,
            user_avatar_url=user_avatar_url,
            message=ChatMessageBase(
                text=message.text,
                image_url=message.image_url
            ),
            status=message.status,
            created_at=message.created_at
        ) for message in messages
    ]

async def switch_chat_room_mode(db: AsyncSession, room_id: int, mode: str) -> None:
    await repo_switch_chat_room_mode(db, room_id, mode)

async def create_chat_message_entry(
    db: AsyncSession,
    room_id: int,
    data: ChatMessageBase,
    direction: ChatMessageDirection
) -> ChatMessage:
    return await repo_create_chat_message_entry(db, room_id, data, direction)

async def create_staff_message(db: AsyncSession, room_id: int, data: ChatMessageBase) -> ChatMessageOut:
    # 查找聊天室
    room = await get_chat_room_by_room_id(db, room_id)
    if not room:
        raise ValueError("Chat room not found")
    
    # 查找用戶
    user = await get_user_by_line_uid(db, room.user.line_uid)
    if not user:
        raise ValueError("User not found")
    
    # 發送訊息到 LINE
    success = LINE_push_message(user.line_uid, data)
    # if not success:
        # raise ValueError("Failed to send message to LINE")

    # 創建訊息
    message = await create_chat_message_entry(
        db=db,
        room_id=room.id,
        data=data,
        direction=ChatMessageDirection.OUTGOING_BY_STAFF
    )
    
    # 更新聊天室狀態
    await touch_chat_room_updated_at(db, room)

    message_out = ChatMessageOut(
        id=message.id,
        direction=message.direction,
        user_avatar_url=None,  
        message=ChatMessageBase(
            text=message.text,
            image_url=message.image_url
        ),
        status=message.status,
        created_at=message.created_at
    )
    return message_out