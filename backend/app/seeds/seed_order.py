import random
from datetime import datetime, timedelta, timezone

from faker import Faker
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums.order import OrderStatus
from app.enums.shipment import ShipmentMethod
from app.models.chat import ChatRoom
from app.models.customer import Customer
from app.models.order import Order

fake = Faker("zh_TW")


async def create_random_order(session: AsyncSession, user: Customer, serial_number: int) -> Order:
    total = round(random.uniform(1000, 3000), 0)
    quantity = random.randint(1, 5)
    note = fake.sentence(nb_words=10)
    delivery_datetime = datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None) + timedelta(
        days=random.randint(1, 3)
    )
    shipment_method = random.choice([ShipmentMethod.STORE_PICKUP, ShipmentMethod.DELIVERY])
    item_type = random.choice(["花束", "盆花"])

    result = await session.execute(select(ChatRoom).where(ChatRoom.customer_id == user.id).limit(1))
    chat_room = result.scalar_one()

    order = Order(
        room_id=chat_room.id,
        customer_id=user.id,
        status=OrderStatus.CONFIRMED,
        item_type=item_type,
        quantity=quantity,
        notes=note,
        total_amount=total,
        shipment_method=shipment_method,
        delivery_address=fake.address() if shipment_method == ShipmentMethod.DELIVERY else None,
        delivery_datetime=delivery_datetime,
    )
    session.add(order)
    await session.flush()
    return order
