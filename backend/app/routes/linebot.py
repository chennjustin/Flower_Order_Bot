from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.responses import PlainTextResponse
from linebot.exceptions import InvalidSignatureError
from linebot.models import MessageEvent, TextMessage, ImageMessage, StickerMessage, FollowEvent

from app.core.deps import get_line_webhook_handler
from app.core.database import get_db
from app.services.user_service import get_user_by_line_uid, create_user
from app.services.message_service import get_chat_room_by_user_id, create_chat_room
from app.schemas.user import UserCreate

api_router = APIRouter()

handler = get_line_webhook_handler()

from app.usecases.linebot_flow import (
    handle_incoming_text_message,
    handle_incoming_image_message,
    handle_incoming_sticker_message,
    run_bot_flow,
)


@api_router.post("/callback")
async def callback(request: Request, db: AsyncSession = Depends(get_db)):
    signature = request.headers.get("X-Line-Signature")
    if not signature:
        raise HTTPException(status_code=400, detail="Missing X-Line-Signature header")

    body = await request.body()
    body_str = body.decode("utf-8")

    try:
        events = get_line_webhook_handler().parser.parse(body_str, signature)
    except InvalidSignatureError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    for event in events:
        if not isinstance(event, MessageEvent):
            continue
        msg = event.message
        if isinstance(msg, TextMessage):
            await dispatch_line_text_message(event, db)
        elif isinstance(msg, ImageMessage):
            await dispatch_line_image_message(event, db)
        elif isinstance(msg, StickerMessage):
            await dispatch_line_sticker_message(event, db)

    return PlainTextResponse("OK")


@handler.add(MessageEvent, message=TextMessage)
async def dispatch_line_text_message(event: MessageEvent, db: AsyncSession):
    await handle_incoming_text_message(event, db)


@handler.add(MessageEvent, message=ImageMessage)
async def dispatch_line_image_message(event: MessageEvent, db: AsyncSession):
    await handle_incoming_image_message(event, db)


@handler.add(MessageEvent, message=StickerMessage)
async def dispatch_line_sticker_message(event: MessageEvent, db: AsyncSession):
    await handle_incoming_sticker_message(event, db)


@handler.add(FollowEvent)
async def handle_follow(event: FollowEvent, db: AsyncSession):
    """
    1. get or create user
    2. get or create chat room
    3. send welcome template message
    """

    user_line_id = event.source.user_id
    user = await get_user_by_line_uid(db, user_line_id)
    if not user:
        user = await create_user(db, UserCreate(line_uid=user_line_id, name="Profile Name"))
        print(f"新使用者 {user_line_id} 已創建")
    else:
        print(f"使用者 {user_line_id} 已存在")

    chat_room = await get_chat_room_by_user_id(db, user.id)
    if not chat_room:
        chat_room = await create_chat_room(db, user.id)
        print(f"新聊天室已創建，使用者 {user_line_id} 的聊天室 ID：{chat_room.id}")

    print("開始自動回覆流程")
    await run_bot_flow(chat_room, "", event, db)
