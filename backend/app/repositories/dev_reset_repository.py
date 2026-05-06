from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.enums.notification import NotificationReceiverType
from app.models.chat import ChatMessage, ChatRoom
from app.models.operation import Notification
from app.models.order import Order, OrderDraft
from app.models.payment import Payment
from app.models.user import User


async def wipe_line_customer_graph(db: AsyncSession, room_id: int, user_id: int) -> None:
    order_ids = (await db.execute(select(Order.id).where(Order.room_id == room_id))).scalars().all()
    if order_ids:
        await db.execute(delete(Payment).where(Payment.order_id.in_(order_ids)))
    await db.execute(delete(Order).where(Order.room_id == room_id))
    await db.execute(delete(OrderDraft).where(OrderDraft.room_id == room_id))
    await db.execute(delete(ChatMessage).where(ChatMessage.room_id == room_id))
    await db.execute(
        delete(Notification).where(
            Notification.receiver_type == NotificationReceiverType.USER,
            Notification.receiver_id == user_id,
        )
    )
    await db.execute(delete(ChatRoom).where(ChatRoom.id == room_id))
    await db.execute(delete(User).where(User.id == user_id))
    await db.commit()

