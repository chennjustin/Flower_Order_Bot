from enum import Enum

class ChatRoomStage(str, Enum):
    WELCOME = "WELCOME"
    IDLE = "IDLE"
    ORDER_CONFIRM = "ORDER_CONFIRM"
    WAITING_OWNER = "WAITING_OWNER"
    BOT_ACTIVE = "BOT_ACTIVE"

class ChatMessageStatus(str, Enum):
    SENT = "SENT"
    PENDING = "PENDING"
    FAILED = "FAILED"

class ChatMessageDirection(str, Enum):
    INCOMING = "INCOMING"
    OUTGOING_BY_BOT = "OUTGOING_BY_BOT"
    OUTGOING_BY_STORE = "OUTGOING_BY_STORE"
    # 舊庫/舊資料可能仍存此值 (與 OUTGOING_BY_STORE 語意相同)
    OUTGOING_BY_STAFF = "OUTGOING_BY_STAFF"


def normalize_chat_message_direction(value: str | ChatMessageDirection) -> ChatMessageDirection:
    if isinstance(value, ChatMessageDirection):
        if value == ChatMessageDirection.OUTGOING_BY_STAFF:
            return ChatMessageDirection.OUTGOING_BY_STORE
        return value
    if value == "OUTGOING_BY_STAFF":
        return ChatMessageDirection.OUTGOING_BY_STORE
    return ChatMessageDirection(value)