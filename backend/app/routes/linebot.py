from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.responses import PlainTextResponse
from linebot.exceptions import InvalidSignatureError
from linebot.models import MessageEvent, TextMessage, ImageMessage, StickerMessage, FollowEvent

from app.core.database import get_db
from app.core.line_client import line_bot_api_for_store, webhook_handler_for_store
from app.models.store import Store
from app.repositories.store_repository import resolve_store_for_webhook
from app.schemas.customer import CustomerCreate
from app.services.message_service import get_chat_room_by_user_id, create_chat_room
from app.services.user_service import get_user_by_line_uid, create_user
from app.usecases.linebot_flow import (
    handle_incoming_text_message,
    handle_incoming_image_message,
    handle_incoming_sticker_message,
    run_bot_flow,
)

api_router = APIRouter()


@api_router.post("/callback")
async def callback(request: Request, db: AsyncSession = Depends(get_db)):
    signature = request.headers.get("X-Line-Signature")
    if not signature:
        raise HTTPException(status_code=400, detail="Missing X-Line-Signature header")

    body = await request.body()
    body_str = body.decode("utf-8")

    store = await resolve_store_for_webhook(db, body_str)

    try:
        events = webhook_handler_for_store(store).parser.parse(body_str, signature)
    except InvalidSignatureError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    for event in events:
        if isinstance(event, FollowEvent):
            await handle_follow(event, store, db)
        elif isinstance(event, MessageEvent):
            msg = event.message
            if isinstance(msg, TextMessage):
                await handle_incoming_text_message(event, store, db)
            elif isinstance(msg, ImageMessage):
                await handle_incoming_image_message(event, store, db)
            elif isinstance(msg, StickerMessage):
                await handle_incoming_sticker_message(event, store, db)

    return PlainTextResponse("OK")


async def handle_follow(event: FollowEvent, store: Store, db: AsyncSession):
    user_line_id = event.source.user_id
    user = await get_user_by_line_uid(db, user_line_id, store.id)
    if not user:
        user = await create_user(
            db,
            CustomerCreate(
                line_uid=user_line_id, name="Profile Name", store_id=store.id
            ),
        )
        print(f"新使用者 {user_line_id} 已創建 (store={store.id})")
    else:
        print(f"使用者 {user_line_id} 已存在 (store={store.id})")

    chat_room = await get_chat_room_by_user_id(db, user.id)
    if not chat_room:
        chat_room = await create_chat_room(db, user.id)
        print(f"新聊天室已創建，使用者 {user_line_id} 的聊天室 ID：{chat_room.id}")

    print("開始自動回覆流程")
    await run_bot_flow(chat_room, "", event, store, db)
