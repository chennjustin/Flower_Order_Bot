from __future__ import annotations

from linebot import LineBotApi

from app.utils.chat_image_storage import save_chat_image


def fetch_line_message_binary(
    line_bot_api: LineBotApi, message_id: str
) -> tuple[bytes, str | None]:
    """同步呼叫 LINE Get content API；請於 asyncio.to_thread 內使用。"""
    blob = line_bot_api.get_message_content(message_id)
    return blob.content, blob.content_type


def save_inbound_line_image(
    public_base_url: str, raw: bytes, content_type: str | None
) -> str:
    return save_chat_image(
        public_base_url=public_base_url,
        raw=raw,
        content_type=content_type,
        subdir="line_images",
    )
