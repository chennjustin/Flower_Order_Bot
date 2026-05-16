"""Staff-uploaded chat images -> disk -> PUBLIC_BASE_URL URL."""

from __future__ import annotations

from app.utils.chat_image_storage import save_chat_image


def save_staff_chat_image(public_base_url: str, raw: bytes, content_type: str) -> str:
    return save_chat_image(
        public_base_url=public_base_url,
        raw=raw,
        content_type=content_type,
        subdir="staff_chat",
    )
