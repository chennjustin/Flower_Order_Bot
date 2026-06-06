import logging

from linebot import LineBotApi
from linebot.exceptions import LineBotApiError
from linebot.models import (
    ConfirmTemplate,
    ImageSendMessage,
    MessageAction,
    QuickReply,
    QuickReplyButton,
    StickerSendMessage,
    TemplateSendMessage,
    TextSendMessage,
)

from app.schemas.chat import ChatMessagePayload


def LINE_push_message(
    line_bot_api: LineBotApi, line_uid: str, data: ChatMessagePayload
) -> bool:
    """
    發送訊息到 LINE
    :param line_bot_api: 該 store 的 LineBotApi
    :param line_uid: 使用者的 LINE UID
    :param data: 訊息內容（擇一：貼圖 / 圖片 URL / 文字）
    """
    pkg = (data.sticker_package_id or "").strip()
    sid = (data.sticker_id or "").strip()
    img = (data.image_url or "").strip()
    txt = (data.text or "").strip()
    try:
        if pkg and sid:
            line_bot_api.push_message(
                line_uid,
                StickerSendMessage(package_id=pkg, sticker_id=sid),
            )
        elif img:
            line_bot_api.push_message(
                line_uid,
                ImageSendMessage(
                    original_content_url=img,
                    preview_image_url=img,
                ),
            )
        elif txt:
            line_bot_api.push_message(line_uid, TextSendMessage(text=txt))
        else:
            logging.warning("[LINE PUSH] 無有效內容")
            return False
        return True

    except LineBotApiError as e:
        logging.error(f"[LINE PUSH] 送出失敗：{e.status_code} - {e.error.message}")
        return False

    except Exception as e:
        logging.exception(f"[LINE PUSH] 未知錯誤：{str(e)}")
        return False


def send_quick_reply_message(
    line_bot_api: LineBotApi, reply_token: str, text: str, options: list[str]
):
    items = [
        QuickReplyButton(action=MessageAction(label=opt, text=opt))
        for opt in options
    ]
    line_bot_api.reply_message(
        reply_token,
        TextSendMessage(text=text, quick_reply=QuickReply(items=items)),
    )


def send_confirm(
    line_bot_api: LineBotApi,
    reply_token: str,
    text: str,
    yes_txt="是",
    no_txt="否",
    yes_reply="yes",
    no_reply="no",
):
    tpl = ConfirmTemplate(
        text=text,
        actions=[
            MessageAction(label=yes_txt, text=yes_reply),
            MessageAction(label=no_txt, text=no_reply),
        ],
    )
    line_bot_api.reply_message(
        reply_token,
        TemplateSendMessage(alt_text=text, template=tpl),
    )
