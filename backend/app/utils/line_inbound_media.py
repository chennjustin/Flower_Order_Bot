from __future__ import annotations

import uuid
from pathlib import Path

from app.core.deps import get_line_bot_api


def _upload_dir() -> Path:
    backend_root = Path(__file__).resolve().parent.parent.parent
    d = backend_root / "uploads" / "line_images"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _suffix_from_content_type(content_type: str | None) -> str:
    if not content_type:
        return ".jpg"
    ct = content_type.lower()
    if "png" in ct:
        return ".png"
    if "gif" in ct:
        return ".gif"
    if "webp" in ct:
        return ".webp"
    return ".jpg"


def fetch_line_message_binary(message_id: str) -> tuple[bytes, str | None]:
    """同步呼叫 LINE Get content API；請於 asyncio.to_thread 內使用。"""
    api = get_line_bot_api()
    blob = api.get_message_content(message_id)
    return blob.content, blob.content_type


def save_inbound_line_image(
    public_base_url: str, raw: bytes, content_type: str | None
) -> str:
    """
    寫入 uploads/line_images，回傳可給前端與 ImageSendMessage 使用的絕對 URL。
    """
    name = f"{uuid.uuid4().hex}{_suffix_from_content_type(content_type)}"
    path = _upload_dir() / name
    path.write_bytes(raw)
    base = public_base_url.rstrip("/")
    return f"{base}/uploads/line_images/{name}"
