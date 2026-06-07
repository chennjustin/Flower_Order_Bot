from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

from linebot import LineBotApi
from linebot.exceptions import LineBotApiError
from linebot.models import FollowEvent, MessageEvent, TextSendMessage
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.line_client import line_bot_api_for_store
from app.enums.chat import ChatMessageDirection, ChatMessageStatus, ChatRoomStage
from app.models.chat import ChatMessage, ChatRoom
from app.models.store import Store
from app.models.user import User
from app.schemas.customer import CustomerCreate
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
from app.utils.line_inbound_media import fetch_line_message_binary, save_inbound_line_image
from app.utils.line_send_message import send_confirm, send_quick_reply_message


BUDGET_OPTIONS = ["500以下", "500-1000", "1000以上"]
COLOR_OPTIONS = ["紅", "白", "粉", "其他"]
FLOWER_TYPE_OPTIONS = ["玫瑰花", "滿天星", "向日葵", "其他"]



async def _publish_room_stage(chat_room: ChatRoom, store_id: int) -> None:
    from app.services.chat_event_bus import publish_chat_room_stage

    stage = (
        chat_room.stage.value
        if hasattr(chat_room.stage, "value")
        else str(chat_room.stage)
    )
    await publish_chat_room_stage(chat_room.id, stage, store_id=store_id)


async def _publish_bot_outgoing(
    db: AsyncSession,
    chat_room: ChatRoom,
    message: ChatMessage,
    store_id: int,
) -> None:
    from app.repositories.chat_repository import touch_chat_room_on_new_message
    from app.services.chat_event_bus import publish_chat_message

    await db.refresh(message)
    await touch_chat_room_on_new_message(
        db,
        chat_room,
        message_at=message.created_at,
        incoming=False,
    )
    await publish_chat_message(db, chat_room.id, message, store_id=store_id)


async def _send_invalid_answer_handoff(
    db: AsyncSession,
    chat_room: ChatRoom,
    line_api: LineBotApi,
    reply_token: str,
) -> None:
    text = "好的！已轉交給客服人員，請稍候。"
    line_api.reply_message(reply_token, TextSendMessage(text))
    message = ChatMessage(
        room_id=chat_room.id,
        direction=ChatMessageDirection.OUTGOING_BY_BOT,
        text=f"[自動回覆已傳送] {text}",
        image_url="",
        status=ChatMessageStatus.PENDING,
        processed=False,
        created_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
        updated_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
    )
    db.add(message)
    await db.commit()
    await _publish_bot_outgoing(db, chat_room, message, chat_room.store_id)


def _store_display_name(store: Store) -> str:
    name = (store.name or "").strip()
    return name if name else "本店"


async def resolve_line_user_and_room(
    db: AsyncSession, user_line_id: str, store: Store
) -> tuple[User, ChatRoom]:
    line_api = line_bot_api_for_store(store)
    user = await get_user_by_line_uid(db, user_line_id, store.id)
    if not user:
        user = await create_user(
            db,
            CustomerCreate(
                line_uid=user_line_id, name="Unknown User", store_id=store.id
            ),
        )

    if user.name == "Unknown User" or user.avatar_url is None:
        profile = await fetch_user_profile(line_api, user_line_id)
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
            await _publish_room_stage(chat_room, store.id)
            print("上次傳訊息是很久以前，已重設成 welcome")

    if await get_order_draft_by_room(db, chat_room.id) is None:
        await create_order_draft_by_room_id(db, chat_room.id)

    return user, chat_room


async def handoff_to_owner_if_order_confirmed(
    chat_room: ChatRoom, db: AsyncSession, *, store_id: int
) -> None:
    if chat_room.stage == ChatRoomStage.ORDER_CONFIRM:
        chat_room.stage = ChatRoomStage.WAITING_OWNER
        chat_room.bot_step = -1
        await db.commit()
        await db.refresh(chat_room)
        await _publish_room_stage(chat_room, store_id)
        print("ORDER_CONFIRM received a new message; switching to WAITING_OWNER.")


async def enter_welcome_stage_and_send_greeting(
    chat_room: ChatRoom,
    event: MessageEvent | FollowEvent,
    store: Store,
    db: AsyncSession,
) -> None:
    """Force room state to WELCOME and send the greeting question."""
    chat_room.stage = ChatRoomStage.WELCOME
    chat_room.bot_step = -1
    await db.commit()
    await db.refresh(chat_room)
    await run_welcome_flow(chat_room, "", event, store, db, include_preface=True)


async def handle_incoming_text_message(
    event: MessageEvent, store: Store, db: AsyncSession
) -> None:
    user_line_id = event.source.user_id
    user_message = event.message.text

    user, chat_room = await resolve_line_user_and_room(db, user_line_id, store)

    message = ChatMessage(
        room_id=chat_room.id,
        direction=ChatMessageDirection.INCOMING,
        text=user_message,
        image_url=None,
        sticker_package_id=None,
        sticker_id=None,
        line_msg_id=str(event.message.id) if event.message.id else None,
        status=ChatMessageStatus.PENDING,
        processed=False,
        created_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
        updated_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
    )

    db.add(message)
    await db.commit()
    await db.refresh(message)

    from app.repositories.chat_repository import touch_chat_room_on_new_message
    from app.services.chat_event_bus import publish_chat_message

    await touch_chat_room_on_new_message(
        db,
        chat_room,
        message_at=message.created_at,
        incoming=True,
    )
    await publish_chat_message(db, chat_room.id, message, store_id=store.id)

    print(f"User {user_line_id} 發送訊息：{user_message}")

    if user_message == "Again":
        chat_room.stage = ChatRoomStage.WELCOME
        chat_room.bot_step = -1
        await db.commit()
        await db.refresh(chat_room)
        await _publish_room_stage(chat_room, store.id)
        print("回到 welcome")
        return

    if chat_room.stage == ChatRoomStage.WELCOME:
        await run_welcome_flow(chat_room, user_message, event, store, db)
        await db.refresh(chat_room)
        if chat_room.stage == ChatRoomStage.BOT_ACTIVE:
            await run_bot_flow(chat_room, "", event, store, db)
        return

    if chat_room.stage == ChatRoomStage.BOT_ACTIVE:
        await run_bot_flow(chat_room, user_message, event, store, db)
        return

    await handoff_to_owner_if_order_confirmed(chat_room, db, store_id=store.id)


async def handle_incoming_image_message(
    event: MessageEvent, store: Store, db: AsyncSession
) -> None:
    user_line_id = event.source.user_id
    line_api = line_bot_api_for_store(store)
    _, chat_room = await resolve_line_user_and_room(db, user_line_id, store)
    mid = event.message.id
    try:
        raw, ct = await asyncio.to_thread(fetch_line_message_binary, line_api, mid)
        public_url = save_inbound_line_image(store.id, raw, ct)
    except Exception as e:
        print(f"[LINE] 無法下載使用者圖片 message_id={mid}: {e}")
        raise

    message = ChatMessage(
        room_id=chat_room.id,
        direction=ChatMessageDirection.INCOMING,
        text="[圖片]",
        image_url=public_url,
        sticker_package_id=None,
        sticker_id=None,
        line_msg_id=str(mid) if mid else None,
        status=ChatMessageStatus.PENDING,
        processed=False,
        created_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
        updated_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    from app.repositories.chat_repository import touch_chat_room_on_new_message
    from app.services.chat_event_bus import publish_chat_message

    await touch_chat_room_on_new_message(
        db,
        chat_room,
        message_at=message.created_at,
        incoming=True,
    )
    await publish_chat_message(db, chat_room.id, message, store_id=store.id)

    await handoff_to_owner_if_order_confirmed(chat_room, db, store_id=store.id)


async def handle_incoming_sticker_message(
    event: MessageEvent, store: Store, db: AsyncSession
) -> None:
    user_line_id = event.source.user_id
    _, chat_room = await resolve_line_user_and_room(db, user_line_id, store)
    pkg = str(event.message.package_id)
    stk = str(event.message.sticker_id)
    mid = event.message.id
    message = ChatMessage(
        room_id=chat_room.id,
        direction=ChatMessageDirection.INCOMING,
        text="[貼圖]",
        image_url=None,
        sticker_package_id=pkg,
        sticker_id=stk,
        line_msg_id=str(mid) if mid else None,
        status=ChatMessageStatus.PENDING,
        processed=False,
        created_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
        updated_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)

    from app.repositories.chat_repository import touch_chat_room_on_new_message
    from app.services.chat_event_bus import publish_chat_message

    await touch_chat_room_on_new_message(
        db,
        chat_room,
        message_at=message.created_at,
        incoming=True,
    )
    await publish_chat_message(db, chat_room.id, message, store_id=store.id)

    await handoff_to_owner_if_order_confirmed(chat_room, db, store_id=store.id)


async def run_welcome_flow(
    chat_room: ChatRoom,
    user_text: str,
    event: MessageEvent | FollowEvent,
    store: Store,
    db: AsyncSession,
    *,
    include_preface: bool = False,
):
    line_api = line_bot_api_for_store(store)
    if chat_room.bot_step == -1:
        welcome_text = f"您好，歡迎來到{_store_display_name(store)}！"
        question_text = "若想要訂購客製化花束，請按「是」~"
        send_confirm(
            line_api,
            event.reply_token,
            question_text,
            preface_text=welcome_text if include_preface else None,
            yes_txt="是",
            no_txt="否",
            yes_reply="啟動智慧訂購流程",
            no_reply="為您轉接老闆",
        )

        welcome_message = ChatMessage(
            room_id=chat_room.id,
            direction=ChatMessageDirection.OUTGOING_BY_BOT,
            text=f"[自動回覆已傳送] {welcome_text}",
            image_url="",
            status=ChatMessageStatus.PENDING,
            processed=False,
            created_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
            updated_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
        )
        question_message = ChatMessage(
            room_id=chat_room.id,
            direction=ChatMessageDirection.OUTGOING_BY_BOT,
            text=f"[自動回覆已傳送] {question_text}",
            image_url="",
            status=ChatMessageStatus.PENDING,
            processed=False,
            created_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
            updated_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
        )

        if include_preface:
            db.add(welcome_message)
        db.add(question_message)
        chat_room.bot_step = 0

        await db.commit()
        await db.refresh(chat_room)
        print("已詢問使用者是否要客製化花束")
        return

    stage_before = chat_room.stage
    if user_text == "啟動智慧訂購流程":
        chat_room.stage = ChatRoomStage.BOT_ACTIVE
        chat_room.bot_step = 1
    else:
        chat_room.stage = ChatRoomStage.WAITING_OWNER
        chat_room.bot_step = -1
        line_api.reply_message(
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
        await _publish_bot_outgoing(db, chat_room, message, store.id)

    await db.commit()
    await db.refresh(chat_room)
    if chat_room.stage != stage_before:
        await _publish_room_stage(chat_room, store.id)


async def run_bot_flow(
    chat_room: ChatRoom,
    text: str,
    event: MessageEvent | FollowEvent,
    store: Store,
    db: AsyncSession,
):
    line_api = line_bot_api_for_store(store)
    STEP_MAP = {
        1: ask_budget,
        2: ask_color,
        3: ask_type,
        4: last,
    }

    current_text = text
    while True:
        stage_before = chat_room.stage
        handler = STEP_MAP.get(chat_room.bot_step)

        if handler is None:
            if chat_room.stage == ChatRoomStage.WELCOME:
                print(
                    "Invalid bot_step detected in WELCOME; recover by replaying welcome greeting."
                )
                await enter_welcome_stage_and_send_greeting(chat_room, event, store, db)
                return
            print(f"Error: No handler for bot_step {chat_room.bot_step}, hand off to owner")
            chat_room.bot_step = -1
            chat_room.stage = ChatRoomStage.WAITING_OWNER
            await db.commit()
            await db.refresh(chat_room)
            if chat_room.stage != stage_before:
                await _publish_room_stage(chat_room, store.id)
            return

        next_step, manual_override, next_question = await handler(
            current_text, event, db, chat_room, line_api
        )

        if manual_override:
            chat_room.stage = ChatRoomStage.WAITING_OWNER
            chat_room.bot_step = -1
        else:
            chat_room.bot_step = next_step
            if next_step == -1:
                chat_room.stage = ChatRoomStage.WAITING_OWNER

        await db.commit()
        await db.refresh(chat_room)
        if chat_room.stage != stage_before:
            await _publish_room_stage(chat_room, store.id)

        if not next_question:
            break
        current_text = ""


async def ask_budget(user_text, event, db, chat_room, line_api: LineBotApi):
    if chat_room.bot_step == 1:
        if user_text.strip() == "":
            send_quick_reply_message(
                line_api,
                event.reply_token,
                "好的～請問預算大概多少呢？",
                BUDGET_OPTIONS,
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
            await _publish_bot_outgoing(db, chat_room, message, chat_room.store_id)

            return 1, False, False
        budget = user_text.strip()
        if budget not in BUDGET_OPTIONS:
            await _send_invalid_answer_handoff(db, chat_room, line_api, event.reply_token)
            return -1, True, False
        if budget == "500以下":
            return 2, False, True
        return 3, False, True


async def ask_color(user_text, event, db, chat_room, line_api: LineBotApi):
    if chat_room.bot_step == 2:
        color = user_text.strip()
        if color:
            if color not in COLOR_OPTIONS:
                await _send_invalid_answer_handoff(db, chat_room, line_api, event.reply_token)
                return -1, True, False
            return 4, False, True

        send_quick_reply_message(
            line_api,
            event.reply_token,
            "請問想要什麼顏色的客製化花束？",
            COLOR_OPTIONS,
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
        await _publish_bot_outgoing(db, chat_room, message, chat_room.store_id)

        return 2, False, False


async def ask_type(user_text, event, db, chat_room, line_api: LineBotApi):
    if chat_room.bot_step == 3:
        flower_type = user_text.strip()
        if flower_type:
            if flower_type not in FLOWER_TYPE_OPTIONS:
                await _send_invalid_answer_handoff(db, chat_room, line_api, event.reply_token)
                return -1, True, False
            return 4, False, True

        send_quick_reply_message(
            line_api,
            event.reply_token,
            "請問想要什麼類型的花材？",
            FLOWER_TYPE_OPTIONS,
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
        await _publish_bot_outgoing(db, chat_room, message, chat_room.store_id)

        return 3, False, False


async def last(user_text, event, db, chat_room, line_api: LineBotApi):
    _ = user_text.strip()
    line_api.reply_message(
        event.reply_token,
        TextSendMessage("👌了解！接下來會交由老闆與您聯繫確認細節。"),
    )
    message = ChatMessage(
        room_id=chat_room.id,
        direction=ChatMessageDirection.OUTGOING_BY_BOT,
        text="[自動回覆已傳送] 👌了解！接下來會交由老闆與您聯繫確認細節。",
        image_url="",
        status=ChatMessageStatus.PENDING,
        processed=False,
        created_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
        updated_at=datetime.now(timezone(timedelta(hours=8))).replace(tzinfo=None),
    )
    db.add(message)
    await db.commit()
    await _publish_bot_outgoing(db, chat_room, message, chat_room.store_id)
    return -1, False, False
