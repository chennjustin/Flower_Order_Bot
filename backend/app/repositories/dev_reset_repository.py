from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import ChatMessage, ChatRoom
from app.models.customer import Customer
from app.models.operation import Notification
from app.models.order import Order, OrderDraft
from app.models.payment import Payment


async def wipe_line_customer_graph(db: AsyncSession, room_id: int, customer_id: int) -> None:
    order_ids = (await db.execute(select(Order.id).where(Order.room_id == room_id))).scalars().all()
    if order_ids:
        await db.execute(delete(Payment).where(Payment.order_id.in_(order_ids)))
    await db.execute(delete(Order).where(Order.room_id == room_id))
    await db.execute(delete(OrderDraft).where(OrderDraft.room_id == room_id))
    await db.execute(delete(ChatMessage).where(ChatMessage.room_id == room_id))
    await db.execute(
        delete(Notification).where(Notification.receiver_customer_id == customer_id)
    )
    await db.execute(delete(ChatRoom).where(ChatRoom.id == room_id))
    await db.execute(delete(Customer).where(Customer.id == customer_id))
    await db.commit()
