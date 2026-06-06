import random
from datetime import datetime, timedelta, timezone

from faker import Faker
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums.chat import ChatMessageDirection, ChatMessageStatus
from app.models.chat import ChatMessage, ChatRoom

fake = Faker("zh_TW")


def _now_naive() -> datetime:
    return datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)


async def seed_initial_room_conversation(session: AsyncSession, room: ChatRoom) -> None:
    messages: list[ChatMessage] = []
    base_time = _now_naive() - timedelta(hours=random.randint(1, 24))

    messages.append(
        ChatMessage(
            room_id=room.id,
            status=ChatMessageStatus.SENT,
            direction=ChatMessageDirection.OUTGOING_BY_BOT,
            text="您好！歡迎使用我們的訂花服務，請問有什麼可以協助您的嗎？",
            created_at=base_time,
        )
    )

    for _ in range(random.randint(3, 7)):
        message_time = base_time + timedelta(minutes=random.randint(5, 30))
        direction = random.choice(
            [
                ChatMessageDirection.INCOMING,
                ChatMessageDirection.OUTGOING_BY_BOT,
                ChatMessageDirection.OUTGOING_BY_STORE,
            ]
        )
        if direction == ChatMessageDirection.INCOMING:
            text = fake.sentence()
        elif direction == ChatMessageDirection.OUTGOING_BY_BOT:
            text = random.choice(
                [
                    "好的，我了解您的需求。",
                    "請問您想要什麼樣的花束呢？",
                    "我們有提供多種花束選擇，您想要哪一種呢？",
                    "請問您需要什麼時候送達呢？",
                    "好的，我已經記錄下來了。",
                ]
            )
        else:
            text = random.choice(
                [
                    "您好，我是客服人員，很高興為您服務。",
                    "您的訂單已經確認了。",
                    "我們會盡快處理您的訂單。",
                    "請問還有其他需要協助的嗎？",
                    "感謝您的訂購！",
                ]
            )

        messages.append(
            ChatMessage(
                room_id=room.id,
                status=ChatMessageStatus.SENT,
                direction=direction,
                text=text,
                created_at=message_time,
            )
        )
        base_time = message_time

    room.last_message_ts = base_time
    for message in messages:
        session.add(message)
    await session.flush()


async def append_room_messages_after_order(session: AsyncSession, room: ChatRoom) -> None:
    base_time = room.last_message_ts or _now_naive()
    messages: list[ChatMessage] = []

    for text, direction in [
        (fake.sentence(), ChatMessageDirection.INCOMING),
        ("好的，已為您新增一筆訂單，我們會依約處理。", ChatMessageDirection.OUTGOING_BY_STORE),
    ]:
        base_time = base_time + timedelta(minutes=random.randint(3, 20))
        messages.append(
            ChatMessage(
                room_id=room.id,
                status=ChatMessageStatus.SENT,
                direction=direction,
                text=text,
                created_at=base_time,
            )
        )

    room.last_message_ts = base_time
    for message in messages:
        session.add(message)
    await session.flush()
