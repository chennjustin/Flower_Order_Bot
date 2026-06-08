from __future__ import annotations

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_user_sse
from app.models.chat import ChatRoom
from app.models.order import Order
from app.models.payment import PaymentMethod
from app.models.store import Store

# 放在獨立模組（非 deps.py）以避免 deps → database → deps 的循環匯入。


async def _store_by_auth_uuid(db: AsyncSession, auth_uuid: str) -> Store | None:
    result = await db.execute(select(Store).where(Store.owner_auth_user_id == auth_uuid))
    return result.scalar_one_or_none()


async def _resolve_store_for_user(db: AsyncSession, user: dict) -> Store:
    """將登入的 Google 帳號解析為其專屬 Store（1:1）。

    流程：
    1. 以 Supabase auth user id 直接查（已綁定者走的快取路徑）。
    2. 查不到 → 以 email 認領一筆尚未綁定（owner_auth_user_id IS NULL）的 store，
       寫入 owner_auth_user_id 完成「首次登入綁定」。
    3. 仍查不到 → 403（管理者尚未在 Supabase 指派此 Gmail）。
    """
    auth_uuid = user.get("id")
    email = (user.get("email") or "").strip().lower()
    if not auth_uuid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid auth user")

    store = await _store_by_auth_uuid(db, auth_uuid)
    if store is not None:
        return store

    # 首次登入：以 email 認領一筆未綁定的 store
    result = await db.execute(
        select(Store).where(
            Store.owner_email == email,
            Store.owner_auth_user_id.is_(None),
        )
    )
    store = result.scalar_one_or_none()
    if store is not None:
        store.owner_auth_user_id = auth_uuid
        try:
            await db.commit()
            await db.refresh(store)
            return store
        except IntegrityError:
            # 並發首次登入：另一個請求已搶先綁定，回退改走 UUID 查詢
            await db.rollback()
            store = await _store_by_auth_uuid(db, auth_uuid)
            if store is not None:
                return store

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Account not linked to a store. Contact your administrator.",
    )


async def get_current_store(
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Store:
    return await _resolve_store_for_user(db, user)


async def get_current_store_sse(
    user: dict = Depends(get_current_user_sse),
    db: AsyncSession = Depends(get_db),
) -> Store:
    return await _resolve_store_for_user(db, user)


async def get_chat_room_for_store(
    db: AsyncSession, room_id: int, store: Store
) -> ChatRoom:
    from app.services.message_service import get_chat_room_by_room_id

    room = await get_chat_room_by_room_id(db, room_id)
    if not room:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat room not found",
        )
    if room.store_id != store.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Chat room does not belong to your store",
        )
    return room


async def get_order_for_store(db: AsyncSession, order_id: int, store: Store) -> Order:
    from app.repositories.order_repository import get_order_by_id

    order = await get_order_by_id(db, order_id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found",
        )
    if order.room_id is None:
        if order.store_id != store.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Order does not belong to your store",
            )
        return order

    from app.services.message_service import get_chat_room_by_room_id

    room = await get_chat_room_by_room_id(db, order.room_id)
    if not room or room.store_id != store.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Order does not belong to your store",
        )
    return order


def assert_payment_method_for_store(method: PaymentMethod, store: Store) -> None:
    if method.store_id != store.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Payment method does not belong to your store",
        )
