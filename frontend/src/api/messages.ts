import { api } from './client'
import type { ChatMessageUi, ChatRoomUi } from '@/types/models'

interface ApiLastMessage {
  text?: string
  timestamp?: string
}

interface ApiChatRoomRow {
  room_id: string
  user_name: string
  last_message?: ApiLastMessage | null
  unread_count?: number
  status: string
  user_avatar_url?: string | null
}

interface ApiMessageRow {
  id: string | number
  direction: string
  message: { text: string }
  created_at: string
  user_avatar_url?: string
}

export async function getLatestMessages(): Promise<ChatRoomUi[]> {
  const res = await api.get<ApiChatRoomRow[]>('/chat_rooms')
  return res.data.map((room) => ({
    id: room.room_id,
    name: room.user_name,
    lastMessage: room.last_message?.text ?? '',
    lastMessageTime: room.last_message?.timestamp
      ? new Date(room.last_message.timestamp)
      : null,
    unreadCount: room.unread_count ?? 0,
    status: room.status,
    avatar: room.user_avatar_url || '',
  }))
}

export async function getRoomMessagesRaw(roomId: string): Promise<ApiMessageRow[]> {
  const res = await api.get<ApiMessageRow[]>(`/chat_rooms/${roomId}/messages`)
  return res.data
}

export function mapRoomMessagesApiToUi(
  rows: ApiMessageRow[],
  roomDisplayName: string
): ChatMessageUi[] {
  return rows.map((msg) => ({
    id: msg.id,
    avatar: msg.user_avatar_url,
    sender:
      msg.direction === 'OUTGOING_BY_STAFF' || msg.direction === 'OUTGOING_BY_BOT'
        ? '我'
        : roomDisplayName,
    text: msg.message?.text ?? '',
    timestamp: new Date(msg.created_at),
    direction: msg.direction,
  }))
}

export async function sendRoomMessage(roomId: string, text: string): Promise<unknown> {
  const res = await api.post(`/chat_rooms/${roomId}/messages`, {
    text,
    image_url: null as string | null,
  })
  return res.data
}
