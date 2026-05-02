from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.models.user import User

from app.schemas.user import UserCreate
from app.repositories.user_repository import (
    create_user as repo_create_user,
    get_user_by_chat_room_id as repo_get_user_by_chat_room_id,
    get_user_by_id as repo_get_user_by_id,
    get_user_by_line_uid as repo_get_user_by_line_uid,
    update_user_info as repo_update_user_info,
)


async def get_line_uid_by_chatroom_id(
        db: AsyncSession,
        chat_room_id: int
    ) -> Optional[str]:
    """
    Given a chat_room_id, return the associated user's LINE UID.

    Args:
        db (AsyncSession): SQLAlchemy async session.
        chat_room_id (int): Primary key of the ChatRoom record.

    Returns:
        Optional[str]: LINE UID if the chat room exists and has one, else None.
    """
    user = await get_user_by_chat_room_id(db, chat_room_id)
    if user and user.line_uid:
        return user.line_uid
    else:
        return None


async def get_user_by_line_uid(db: AsyncSession, line_uid: str) -> User:
    return await repo_get_user_by_line_uid(db, line_uid)

async def get_user_by_id(db: AsyncSession, user_id: int) -> User:
    return await repo_get_user_by_id(db, user_id)

async def get_user_by_chat_room_id(
        db: AsyncSession, 
        chat_room_id: int
    ) -> Optional[User]:
    """
    Given a chat_room_id, return the associated User.

    Args:
        db (AsyncSession): SQLAlchemy async session.
        chat_room_id (int): Primary key of the ChatRoom record.

    Returns:
        Optional[User]: User object if found, else None.
    """
    return await repo_get_user_by_chat_room_id(db, chat_room_id)

async def create_user(
        db: AsyncSession, 
        user_data: UserCreate
        ) -> User:
    return await repo_create_user(db, user_data)


async def update_user_info(
                db: AsyncSession,
                user_id: int,
                name: Optional[str] = None,
                phone: Optional[str] = None,
            ) -> User:
    return await repo_update_user_info(db, user_id, name=name, phone=phone)