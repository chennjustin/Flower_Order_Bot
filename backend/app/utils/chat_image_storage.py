from __future__ import annotations

import uuid

from app.utils.supabase_storage import upload_public_object

# LINE ImageSendMessage accepts JPEG/PNG; keep GIF/WebP uploads but store with a sane extension.
_ALLOWED_UPLOAD_CT = frozenset(
    {"image/jpeg", "image/png", "image/gif", "image/webp"}
)


def _suffix_from_content_type(content_type: str | None) -> str:
    ct = (content_type or "").lower()
    if "png" in ct:
        return ".png"
    if "gif" in ct:
        return ".gif"
    if "webp" in ct:
        return ".webp"
    return ".jpg"


def _normalize_content_type(content_type: str | None) -> str:
    ct = (content_type or "image/jpeg").split(";")[0].strip().lower()
    if ct in _ALLOWED_UPLOAD_CT:
        return ct
    return "image/jpeg"


def save_chat_image(
    store_id: int,
    raw: bytes,
    content_type: str | None,
    subdir: str,
) -> str:
    """
    Upload chat image bytes to Supabase Storage and return a public HTTPS URL.
    Shared by staff outbound and inbound LINE customer image flows.
    """
    ct = _normalize_content_type(content_type)
    name = f"{uuid.uuid4().hex}{_suffix_from_content_type(ct)}"
    object_path = f"store_{store_id}/{subdir}/{name}"
    return upload_public_object(object_path, raw, ct)
