from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator, model_validator

from app.enums.chat import (
    ChatMessageDirection,
    ChatMessageStatus,
    ChatRoomStage,
    normalize_chat_message_direction,
)

class LastMessage(BaseModel):
    text: str
    timestamp: datetime

class ChatRoomOut(BaseModel):
    room_id: int
    user_name: str
    user_avatar_url: Optional[str] = None
    unread_count: int
    status: ChatRoomStage
    last_message: Optional[LastMessage]


class ChatMessagePayload(BaseModel):
    """API 回應與 LINE push 使用的訊息欄位（可同時含文字與貼圖欄位等舊資料）。"""

    text: Optional[str] = None
    image_url: Optional[str] = None
    sticker_package_id: Optional[str] = None
    sticker_id: Optional[str] = None


class ChatMessageCreate(BaseModel):
    """POST /chat_rooms/{room_id}/messages：擇一送出（文字／圖片 URL／貼圖）。"""

    text: Optional[str] = None
    image_url: Optional[str] = None
    sticker_package_id: Optional[str] = None
    sticker_id: Optional[str] = None

    @model_validator(mode="after")
    def exactly_one_payload(self) -> "ChatMessageCreate":
        t = (self.text or "").strip()
        img = (self.image_url or "").strip()
        pkg = (self.sticker_package_id or "").strip()
        sid = (self.sticker_id or "").strip()
        has_text = bool(t)
        has_image = bool(img)
        has_sticker = bool(pkg and sid)
        if int(has_text) + int(has_image) + int(has_sticker) != 1:
            raise ValueError(
                "請擇一：純文字、圖片 URL，或貼圖（同時提供 sticker_package_id 與 sticker_id）"
            )
        return self


class StaffChatImageUploadOut(BaseModel):
    """POST upload_image 回傳可供 ImageSendMessage 使用的公開 HTTPS URL（見 PUBLIC_BASE_URL）。"""

    image_url: str


class SwitchModeBody(BaseModel):
    """POST /chat_rooms/{room_id}/switch_mode 請求體。"""

    stage: ChatRoomStage


class ChatMessageOut(BaseModel):
    id: int
    user_avatar_url: Optional[str] = None
    direction: ChatMessageDirection
    message: ChatMessagePayload
    status: ChatMessageStatus
    created_at: datetime

    @field_validator("direction", mode="before")
    @classmethod
    def _coerce_direction(cls, value: object) -> ChatMessageDirection:
        if value is None:
            raise ValueError("direction is required")
        return normalize_chat_message_direction(
            value.value if isinstance(value, ChatMessageDirection) else str(value)
        )
