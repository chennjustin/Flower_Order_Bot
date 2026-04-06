from app.schemas.order import OrderDraftOut
from app.usecases.organize_order_draft import organize_order_draft


async def organize_data(db, chat_room_id: int) -> OrderDraftOut:
    return await organize_order_draft(db, chat_room_id)

