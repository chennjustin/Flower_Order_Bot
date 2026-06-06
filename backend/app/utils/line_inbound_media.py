from __future__ import annotations

from app.core.deps import get_line_bot_api
from app.utils.chat_image_storage import save_chat_image


def fetch_line_message_binary(message_id: str) -> tuple[bytes, str | None]:
    """同步呼叫 LINE Get content API；請於 asyncio.to_thread 內使用。"""
    api = get_line_bot_api()
    blob = api.get_message_content(message_id)
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
