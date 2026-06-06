import random
from datetime import datetime, timedelta, timezone

from faker import Faker
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums.chat import ChatRoomStage
from app.models.chat import ChatRoom
from app.models.customer import Customer
from app.models.order import OrderDraft
from app.repositories.store_repository import get_seed_store_id

fake = Faker("zh_TW")

REUSE_EXISTING_CUSTOMER_CHANCE = 0.55


async def resolve_seed_store_id(session: AsyncSession) -> int:
    store_id = await get_seed_store_id(session)
    if store_id is None:
        raise RuntimeError("資料庫中沒有 store，請先執行 provision-stores 建立店家資料。")
    return store_id


async def list_customer_rooms_for_store(
    session: AsyncSession, store_id: int
) -> list[tuple[Customer, ChatRoom]]:
    result = await session.execute(
        select(Customer, ChatRoom)
        .join(ChatRoom, ChatRoom.customer_id == Customer.id)
        .where(Customer.store_id == store_id, ChatRoom.store_id == store_id)
        .order_by(ChatRoom.id.desc())
    )
    return list(result.all())


async def create_new_customer_with_room(
    session: AsyncSession, store_id: int, *, serial_hint: int
) -> tuple[Customer, ChatRoom]:
    user = Customer(
        line_uid=f"seed-{store_id}-{serial_hint}-{fake.uuid4()}",
        name=fake.name(),
        phone=fake.phone_number(),
        has_ordered=False,
        avatar_url=fake.image_url(width=200, height=200),
        store_id=store_id,
    )
    session.add(user)
    await session.flush()

    now = datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None)
    room = ChatRoom(
        store_id=store_id,
        customer_id=user.id,
        stage=ChatRoomStage.WELCOME,
        bot_step=-1,
        unread_count=random.randint(0, 5),
        last_message_ts=now,
    )
    session.add(room)
    await session.flush()

    draft = OrderDraft(room_id=room.id, customer_id=user.id)
    session.add(draft)
    await session.flush()
    return user, room


async def pick_customer_room_for_order(
    session: AsyncSession,
    store_id: int,
    *,
    existing_pool: list[tuple[Customer, ChatRoom]],
    serial_hint: int,
) -> tuple[Customer, ChatRoom, bool]:
    """Return (customer, room, is_new_room)."""
    if existing_pool and random.random() < REUSE_EXISTING_CUSTOMER_CHANCE:
        customer, room = random.choice(existing_pool)
        return customer, room, False

    customer, room = await create_new_customer_with_room(
        session, store_id, serial_hint=serial_hint
    )
    existing_pool.append((customer, room))
    return customer, room, True


def mark_customer_and_room_after_order(customer: Customer, room: ChatRoom) -> None:
    customer.has_ordered = True
    room.stage = ChatRoomStage.ORDER_CONFIRM
    room.unread_count = max(room.unread_count, random.randint(0, 2))
