from __future__ import annotations

import json
import logging
from typing import Any, AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.redis_client import get_redis, is_redis_enabled
from app.enums.chat import ChatMessageDirection
from app.models.chat import ChatMessage
from app.schemas.chat import ChatMessageOut, ChatMessagePayload
from app.services.user_service import get_user_by_id

logger = logging.getLogger(__name__)

ROOM_CHANNEL_PREFIX = "flower:chat:room:"
ROOMS_CHANNEL = "flower:chat:rooms"
_CHAT_EVENT_TYPES = frozenset({"message", "stage"})


def room_channel(room_id: int) -> str:
    return f"{ROOM_CHANNEL_PREFIX}{room_id}"


def payload_from_chat_row(message: ChatMessage) -> ChatMessagePayload:
    return ChatMessagePayload(
        text=message.text or None,
        image_url=message.image_url or None,
        sticker_package_id=message.sticker_package_id,
        sticker_id=message.sticker_id,
    )


async def build_chat_message_out(
    db: AsyncSession, room_id: int, message: ChatMessage
) -> ChatMessageOut:
    from app.services.message_service import get_chat_room_by_room_id

    room = message.room
    customer_id = room.customer_id if room else None
    if customer_id is None:
        loaded = await get_chat_room_by_room_id(db, room_id)
        customer_id = loaded.customer_id if loaded else None

    user_avatar_url = None
    if customer_id is not None:
        user = await get_user_by_id(db, customer_id)
        if user and message.direction == ChatMessageDirection.INCOMING:
            user_avatar_url = user.avatar_url

    return ChatMessageOut(
        id=message.id,
        direction=message.direction,
        user_avatar_url=user_avatar_url,
        message=payload_from_chat_row(message),
        status=message.status,
        created_at=message.created_at,
    )


async def publish_event(channel: str, payload: dict[str, Any]) -> None:
    if not is_redis_enabled():
        return
    client = await get_redis()
    if client is None:
        return
    try:
        await client.publish(channel, json.dumps(payload, default=str))
    except Exception:
        logger.exception("Failed to publish Redis chat event on %s", channel)


async def publish_chat_message(
    db: AsyncSession, room_id: int, message: ChatMessage, *, store_id: int
) -> None:
    out = await build_chat_message_out(db, room_id, message)
    await publish_chat_message_out(room_id, out, store_id=store_id)


async def publish_chat_message_out(
    room_id: int, out: ChatMessageOut, *, store_id: int
) -> None:
    payload = {
        "type": "message",
        "room_id": room_id,
        "store_id": store_id,
        "message": out.model_dump(mode="json"),
    }
    await publish_event(room_channel(room_id), payload)
    await publish_event(ROOMS_CHANNEL, payload)


async def publish_chat_room_stage(
    room_id: int, stage: str, *, store_id: int
) -> None:
    payload = {
        "type": "stage",
        "room_id": room_id,
        "store_id": store_id,
        "stage": stage,
    }
    await publish_event(room_channel(room_id), payload)
    await publish_event(ROOMS_CHANNEL, payload)


async def subscribe_room_events(room_id: int) -> AsyncIterator[str]:
    """Yield raw JSON payloads from Redis pub/sub for one chat room."""
    client = await get_redis()
    if client is None:
        return

    pubsub = client.pubsub()
    channel = room_channel(room_id)
    await pubsub.subscribe(channel)
    try:
        while True:
            raw = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=30.0
            )
            if raw is None:
                yield ""
                continue
            data = raw.get("data")
            if not isinstance(data, str) or not data:
                continue
            try:
                event_type = json.loads(data).get("type")
            except json.JSONDecodeError:
                continue
            if event_type not in _CHAT_EVENT_TYPES:
                continue
            yield data
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.aclose()


async def subscribe_rooms_events() -> AsyncIterator[str]:
    """Yield list-level chat events (all rooms)."""
    client = await get_redis()
    if client is None:
        return

    pubsub = client.pubsub()
    await pubsub.subscribe(ROOMS_CHANNEL)
    try:
        while True:
            raw = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=30.0
            )
            if raw is None:
                yield ""
                continue
            data = raw.get("data")
            if not isinstance(data, str) or not data:
                continue
            try:
                event_type = json.loads(data).get("type")
            except json.JSONDecodeError:
                continue
            if event_type not in _CHAT_EVENT_TYPES:
                continue
            yield data
    finally:
        await pubsub.unsubscribe(ROOMS_CHANNEL)
        await pubsub.aclose()
