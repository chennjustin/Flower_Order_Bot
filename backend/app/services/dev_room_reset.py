from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.dev_reset_repository import wipe_line_customer_graph


async def wipe_line_customer_for_dev(db: AsyncSession, room_id: int, user_id: int) -> None:
    """
    刪除該聊天室底下訊息、草稿、訂單與付款，再刪聊天室與顧客 User。
    僅應在 LINE_TEST_RESET_PHRASE 命中時呼叫（開發用）。
    """
    await wipe_line_customer_graph(db, room_id, user_id)
