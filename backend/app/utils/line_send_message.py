import logging

from linebot import LineBotApi
from linebot.exceptions import LineBotApiError
from linebot.models import (
    BubbleContainer,
    BoxComponent,
    ConfirmTemplate,
    FlexSendMessage,
    ImageSendMessage,
    MessageAction,
    QuickReply,
    QuickReplyButton,
    SeparatorComponent,
    StickerSendMessage,
    TemplateSendMessage,
    TextComponent,
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


def send_order_confirmation_flex(
    line_bot_api: LineBotApi,
    line_uid: str,
    store_name: str,
    fields: list[tuple[str, str]],
) -> bool:
    """Push an order confirmation Flex Message card to the customer.

    fields: list of (label, value) pairs in display order.
    """
    rows: list = []
    for i, (label, value) in enumerate(fields):
        if i > 0:
            rows.append(SeparatorComponent(margin="sm", color="#EEEEEE"))
        rows.append(
            BoxComponent(
                layout="horizontal",
                margin="sm",
                contents=[
                    TextComponent(
                        text=label,
                        size="sm",
                        color="#888888",
                        flex=3,
                        wrap=True,
                    ),
                    TextComponent(
                        text=value or "—",
                        size="sm",
                        color="#333333",
                        flex=5,
                        wrap=True,
                        align="end",
                    ),
                ],
            )
        )

    bubble = BubbleContainer(
        body=BoxComponent(
            layout="vertical",
            contents=[
                TextComponent(
                    text=store_name,
                    size="xs",
                    color="#888888",
                    margin="none",
                ),
                TextComponent(
                    text="訂單確認",
                    size="xl",
                    weight="bold",
                    color="#333333",
                    margin="sm",
                ),
                SeparatorComponent(margin="md", color="#DDDDDD"),
                BoxComponent(
                    layout="vertical",
                    margin="md",
                    contents=rows,
                ),
            ],
        ),
    )

    try:
        line_bot_api.push_message(
            line_uid,
            FlexSendMessage(alt_text="訂單確認", contents=bubble),
        )
        return True
    except LineBotApiError as e:
        logging.error(f"[LINE FLEX] 送出失敗：{e.status_code} - {e.error.message}")
        return False
    except Exception as e:
        logging.exception(f"[LINE FLEX] 未知錯誤：{str(e)}")
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
    preface_text: str | None = None,
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
    messages: list[TextSendMessage | TemplateSendMessage] = []
    if preface_text:
        messages.append(TextSendMessage(text=preface_text))
    messages.append(TemplateSendMessage(alt_text=text, template=tpl))
    line_bot_api.reply_message(reply_token, messages)
