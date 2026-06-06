import random
from datetime import datetime, timedelta, timezone

from faker import Faker
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums.order import OrderStatus
from app.enums.payment import PaymentStatus
from app.enums.shipment import ShipmentMethod
from app.models.chat import ChatRoom
from app.models.customer import Customer
from app.models.order import Order

fake = Faker("zh_TW")

ORDER_STATUSES_FOR_SEED = (
    OrderStatus.CONFIRMED,
    OrderStatus.CONFIRMED,
    OrderStatus.CONFIRMED,
    OrderStatus.PENDING,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
)


async def create_random_order(
    session: AsyncSession,
    user: Customer,
    room: ChatRoom,
) -> Order:
    total = round(random.uniform(1000, 3000), 0)
    quantity = random.randint(1, 5)
    note = fake.sentence(nb_words=10)
    delivery_datetime = datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None) + timedelta(
        days=random.randint(1, 3)
    )
    shipment_method = random.choice([ShipmentMethod.STORE_PICKUP, ShipmentMethod.DELIVERY])
    item_type = random.choice(["花束", "盆花"])

    order = Order(
        room_id=room.id,
        customer_id=user.id,
        status=random.choice(ORDER_STATUSES_FOR_SEED),
        customer_name=user.name,
        customer_phone=user.phone or "",
        item_type=item_type,
        quantity=quantity,
        notes=note,
        total_amount=total,
        shipment_method=shipment_method,
        pay_status=PaymentStatus.PENDING,
        delivery_address=fake.address() if shipment_method == ShipmentMethod.DELIVERY else None,
        delivery_datetime=delivery_datetime,
    )
    session.add(order)
    await session.flush()
    return order
