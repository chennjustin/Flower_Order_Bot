"""Staff-uploaded chat images → disk → PUBLIC_BASE_URL URL for LINE ImageSendMessage."""

from __future__ import annotations

import uuid
from pathlib import Path


def _suffix_from_content_type(content_type: str) -> str:
    ct = (content_type or "").lower()
    if "png" in ct:
        return ".png"
    if "gif" in ct:
        return ".gif"
    if "webp" in ct:
        return ".webp"
    return ".jpg"


def save_staff_chat_image(public_base_url: str, raw: bytes, content_type: str) -> str:
    backend_root = Path(__file__).resolve().parent.parent.parent
    upload_dir = backend_root / "uploads" / "staff_chat"
    upload_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{_suffix_from_content_type(content_type)}"
    path = upload_dir / name
    path.write_bytes(raw)
    base = public_base_url.rstrip("/")
    return f"{base}/uploads/staff_chat/{name}"
