from __future__ import annotations

from datetime import datetime, timedelta, timezone

from linebot.exceptions import LineBotApiError
from linebot.models import MessageEvent, TextMessage, TextSendMessage
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_line_bot_api
from app.enums.chat import ChatMessageDirection, ChatMessageStatus, ChatRoomStage
from app.models.chat import ChatMessage, ChatRoom
from app.schemas.user import UserCreate
from app.services.message_service import (
    create_chat_room,
    get_chat_room_by_user_id,
    get_latest_message,
)
from app.services.order_service import (
    create_order_draft_by_room_id,
    get_order_draft_by_room,
)
from app.services.user_service import create_user, get_user_by_line_uid
from app.utils.line_get_profile import fetch_user_profile
from app.utils.line_send_message import send_confirm, send_quick_reply_message


async def handle_incoming_text_message(event: MessageEvent, db: AsyncSession) -> None:
    """
    Use case entrypoint for an incoming LINE TextMessage.

    Keep behavior identical to the previous inline implementation in routes.
    """
    user_line_id = event.source.user_id
    user_message = event.message.text

    user = await get_user_by_line_uid(db, user_line_id)
    if not user:
        user = await create_user(db, UserCreate(line_uid=user_line_id, name="Unknown User"))

    if user.name == "Unknown User" or user.avatar_url is None:
        try:
            profile = await fetch_user_profile(user_line_id)
        except LineBotApiError as e:
            print(f"Error fetching user profile: {e.status_code} {e.error.message}")
            profile = None

        if profile:
            user.name = profile.display_name
            user.avatar_url = profile.picture_url if profile.picture_url else ""
            await db.commit()

    chat_room = await get_chat_room_by_user_id(db, user.id)
    if not chat_room:
        chat_room = await create_chat_room(db, user.id)
        print(f"新聊天室已創建，使用者 {user_line_id} 的聊天室 ID：{chat_room.id}")

    latest_msg = await get_latest_message(db, chat_room.id)
    tz = timezone(timedelta(hours=8))
    one_week_ago = datetime.now(tz).replace(tzinfo=None) - timedelta(days=7)

    if latest_msg:
        msg_time = latest_msg.created_at
        if msg_time < one_week_ago:
            chat_room.stage = ChatRoomStage.WELCOME
            chat_room.bot_step = -1
            await db.commit()
            await db.refresh(chat_room)
            print("上次傳訊息是很久以前，已重設成 welcome")

    if await get_order_draft_by_room(db, chat_room.id) is None:
        await create_order_draft_by_room_id(db, chat_room.id)

    message = ChatMessage(
        room_id=chat_room.id,
        direction=ChatMessageDirection.INCOMING,
        text=user_message,
        image_url="",
        status=ChatMessageStatus.PENDING,
        processed=False,
        created_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
        updated_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
    )

    db.add(message)
    await db.commit()
    await db.refresh(message)

    print(f"User {user_line_id} 發送訊息：{user_message}")

    if user_message == "Again":
        chat_room.stage = ChatRoomStage.WELCOME
        chat_room.bot_step = -1
        await db.commit()
        await db.refresh(chat_room)
        print("回到 welcome")
        return

    if chat_room.stage == ChatRoomStage.WELCOME:
        await run_welcome_flow(chat_room, user_message, event, db)
        await db.refresh(chat_room)
        if chat_room.stage == ChatRoomStage.BOT_ACTIVE:
            await run_bot_flow(chat_room, "", event, db)
        return

    if chat_room.stage == ChatRoomStage.BOT_ACTIVE:
        await run_bot_flow(chat_room, user_message, event, db)
        return

    if chat_room.stage == ChatRoomStage.ORDER_CONFIRM:
        chat_room.stage = ChatRoomStage.WAITING_OWNER
        chat_room.bot_step = -1
        await db.commit()
        await db.refresh(chat_room)
        print("訂單確認後出現訊息，轉交「人工回覆」模式。")


async def run_welcome_flow(
    chat_room: ChatRoom,
    user_text: str,
    event: MessageEvent,
    db: AsyncSession,
):
    if chat_room.bot_step == -1:
        send_confirm(
            event.reply_token,
            "您好，歡迎來到奇美花店，若想要訂購客製化花束，請按「是」~",
            yes_txt="是",
            no_txt="否",
            yes_reply="啟動智慧訂購流程",
            no_reply="直接轉接老闆",
        )

        message = ChatMessage(
            room_id=chat_room.id,
            direction=ChatMessageDirection.OUTGOING_BY_BOT,
            text="[自動回覆已傳送] 詢問是否要訂購客製化花束。",
            image_url="",
            status=ChatMessageStatus.PENDING,
            processed=False,
            created_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
            updated_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
        )

        db.add(message)
        chat_room.bot_step = 0

        await db.commit()
        await db.refresh(chat_room)
        print("已詢問使用者是否要客製化花束")
        return

    if user_text == "啟動智慧訂購流程":
        chat_room.stage = ChatRoomStage.BOT_ACTIVE
        chat_room.bot_step = 1
    else:
        chat_room.stage = ChatRoomStage.WAITING_OWNER
        chat_room.bot_step = -1
        get_line_bot_api().reply_message(
            event.reply_token,
            TextSendMessage("好的！已轉交給客服人員，請稍候。"),
        )

        message = ChatMessage(
            room_id=chat_room.id,
            direction=ChatMessageDirection.OUTGOING_BY_BOT,
            text="[自動回覆已傳送] 好的！已轉交給客服人員，請稍候。",
            image_url="",
            status=ChatMessageStatus.PENDING,
            processed=False,
            created_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
            updated_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
        )
        db.add(message)
        await db.commit()

    await db.commit()
    await db.refresh(chat_room)


async def run_bot_flow(chat_room: ChatRoom, text: str, event: MessageEvent, db: AsyncSession):
    STEP_MAP = {
        1: ask_budget,
        2: ask_color,
        3: ask_type,
        4: last,
    }

    while True:
        handler = STEP_MAP.get(chat_room.bot_step)

        if handler is None:
            print(f"Error: No handler for bot_step {chat_room.bot_step}, reset bot_step to 0")
            chat_room.bot_step = 0
            chat_room.stage = ChatRoomStage.WAITING_OWNER
            await db.commit()
            return

        next_step, manual_override, next_question = await handler(text, event, db, chat_room)

        if manual_override:
            chat_room.stage = ChatRoomStage.WAITING_OWNER
            chat_room.bot_step = -1
        else:
            chat_room.bot_step = next_step
            if next_step == -1:
                chat_room.stage = ChatRoomStage.WAITING_OWNER

        await db.commit()

        if not next_question:
            break


async def ask_budget(user_text, event, db, chat_room):
    if chat_room.bot_step == 1:
        if user_text.strip() == "":
            send_quick_reply_message(
                event.reply_token,
                "好的～請問預算大概多少呢？",
                ["500以下", "500-1000", "1000以上"],
            )

            message = ChatMessage(
                room_id=chat_room.id,
                direction=ChatMessageDirection.OUTGOING_BY_BOT,
                text="[自動回覆已傳送] 詢問預算金額。",
                image_url="",
                status=ChatMessageStatus.PENDING,
                processed=False,
                created_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
                updated_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
            )
            db.add(message)
            await db.commit()

            return 1, False, False
        else:
            budget = user_text.strip()
            if budget == "500以下":
                return 2, False, True
            else:
                return 3, False, True


async def ask_color(user_text, event, db, chat_room):
    if chat_room.bot_step == 2:
        send_quick_reply_message(
            event.reply_token,
            "請問想要什麼顏色的客製化花束？",
            ["紅", "白", "粉", "其他"],
        )
        message = ChatMessage(
            room_id=chat_room.id,
            direction=ChatMessageDirection.OUTGOING_BY_BOT,
            text="[自動回覆已傳送] 詢問顏色。",
            image_url="",
            status=ChatMessageStatus.PENDING,
            processed=False,
            created_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
            updated_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
        )
        db.add(message)
        await db.commit()

        return 4, False, False


async def ask_type(user_text, event, db, chat_room):
    if chat_room.bot_step == 3:
        send_quick_reply_message(
            event.reply_token,
            "請問想要什麼類型的花材？",
            ["玫瑰花", "滿天星", "向日葵", "其他"],
        )
        message = ChatMessage(
            room_id=chat_room.id,
            direction=ChatMessageDirection.OUTGOING_BY_BOT,
            text="[自動回覆已傳送] 詢問花材。",
            image_url="",
            status=ChatMessageStatus.PENDING,
            processed=False,
            created_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
            updated_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
        )
        db.add(message)
        await db.commit()

        return 4, False, False


async def last(user_text, event, db, chat_room):
    _ = user_text.strip()
    get_line_bot_api().reply_message(
        event.reply_token,
        TextSendMessage("👌了解！已記錄到後臺～接下來會交由老闆與您聯繫確認細節。"),
    )
    message = ChatMessage(
        room_id=chat_room.id,
        direction=ChatMessageDirection.OUTGOING_BY_BOT,
        text="[自動回覆已傳送] 👌了解！已記錄到後臺～接下來會交由老闆與您聯繫確認細節。",
        image_url="",
        status=ChatMessageStatus.PENDING,
        processed=False,
        created_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
        updated_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
    )
    db.add(message)
    await db.commit()
    return -1, False, False

