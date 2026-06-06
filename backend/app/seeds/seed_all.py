import asyncio

from app.core.database import get_db
from app.seeds.seed_message import append_room_messages_after_order, seed_initial_room_conversation
from app.seeds.seed_order import create_random_order
from app.seeds.seed_user import (
    list_customer_rooms_for_store,
    mark_customer_and_room_after_order,
    pick_customer_room_for_order,
    resolve_seed_store_id,
)

ORDERS_PER_API_CALL = 10

_serial_hint = 0


async def generate_fake_data(count: int = ORDERS_PER_API_CALL) -> None:
    global _serial_hint
    order_count = ORDERS_PER_API_CALL
    async for session in get_db():
        created = await seed_test_data(session, order_count)
        _serial_hint += order_count
        print(f"✅ 測試資料產生完畢：store 種子店、{created} 筆訂單")


async def seed_test_data(session, count: int) -> int:
    global _serial_hint
    store_id = await resolve_seed_store_id(session)
    existing_pool = await list_customer_rooms_for_store(session, store_id)
    batch_start = _serial_hint

    for i in range(count):
        customer, room, is_new_room = await pick_customer_room_for_order(
            session,
            store_id,
            existing_pool=existing_pool,
            serial_hint=batch_start + i + 1,
        )

        if is_new_room:
            await seed_initial_room_conversation(session, room)
        else:
            await append_room_messages_after_order(session, room)

        await create_random_order(session, customer, room)
        mark_customer_and_room_after_order(customer, room)

    await session.commit()
    return count


if __name__ == "__main__":
    asyncio.run(generate_fake_data())
