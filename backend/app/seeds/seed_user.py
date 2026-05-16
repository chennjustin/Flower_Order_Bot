import random
from datetime import datetime, timedelta, timezone

from faker import Faker
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums.chat import ChatRoomStage
from app.models.chat import ChatRoom
from app.models.customer import Customer
from app.models.order import OrderDraft
from app.repositories.store_repository import get_first_store_id

fake = Faker("zh_TW")


async def create_random_user(session: AsyncSession, serial_number: int) -> tuple[Customer, ChatRoom]:
    store_id = await get_first_store_id(session)
    if store_id is None:
        raise RuntimeError("資料庫中沒有 store，請先在 Supabase 建立店家資料。")

    user = Customer(
        line_uid=fake.uuid4(),
        name=fake.name(),
        phone=fake.phone_number(),
        has_ordered=False,
        avatar_url=fake.image_url(width=200, height=200),
        store_id=store_id,
    )
    session.add(user)
    await session.flush()

    room = ChatRoom(
        store_id=store_id,
        customer_id=user.id,
        stage=ChatRoomStage.WELCOME,
        bot_step=-1,
        unread_count=random.randint(0, 5),
        last_message_ts=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
    )
    session.add(room)
    await session.flush()

    draft = OrderDraft(room_id=room.id, customer_id=user.id)
    session.add(draft)
    await session.flush()
    return user, room
