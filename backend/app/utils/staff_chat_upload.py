"""Staff-uploaded chat images -> Supabase Storage -> public HTTPS URL."""

from __future__ import annotations

from app.utils.chat_image_storage import save_chat_image


def save_staff_chat_image(store_id: int, raw: bytes, content_type: str) -> str:
    return save_chat_image(
        store_id=store_id,
        raw=raw,
        content_type=content_type,
        subdir="staff_chat",
    )
